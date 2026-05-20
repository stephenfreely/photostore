/**
 * Guest photo API — unauthenticated Cognito Identity Pool users (max 2 photos).
 *
 * **Who is a "guest"?**
 * Before sign-in, Amplify can still give the browser a Cognito *Identity Pool*
 * identity (`fetchAuthSession().identityId`). That id is not a User Pool `sub`,
 * but it is stable per browser/device until the user signs in.
 *
 * **How auth works here (no JWT)**
 * Guest routes are *not* behind the JWT authorizer. The client must send
 * `X-Guest-Identity-Id: <identityId>` on every request. We trust that header
 * only for scoping data — S3 keys and DynamoDB `ownerId` are namespaced under
 * that id so one guest cannot read or claim another guest's objects.
 *
 * **Upload flow (same pattern as signed-in users)**
 * 1. `POST /guest/photos/upload-url` — get `photoId`, `s3Key`, presigned PUT URL
 * 2. Client `PUT`s bytes to S3 using `uploadUrl`
 * 3. `POST /guest/photos` — save metadata (`photoId`, `s3Key`, `caption`) in DynamoDB
 *
 * **After sign-in**
 * Objects live under `guests/{identityId}/photos/` until the client calls
 * `POST /photos/merge` with the saved `guestIdentityId` (see `photos.ts` `merge`).
 *
 * **Limits**
 * Guests may store at most {@link GUEST_PHOTO_LIMIT} photos. Handlers check
 * the count before minting upload URLs and before `create`.
 */

import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { docClient, photosTableName } from "../clients/dynamo";
import {
  contentTypeForS3Key,
  extensionForContentType,
  photosBucketName,
  s3Client,
  UPLOAD_URL_EXPIRES_SECONDS,
  VIEW_URL_EXPIRES_SECONDS,
} from "../clients/s3";
import type { PhotoItem, PhotoListItem } from "./photos";
import {
  GUEST_PHOTO_LIMIT,
  guestOwnerId,
  isS3KeyOwnedByGuest,
  requireGuestIdentityId,
  s3KeyPrefixForGuest,
} from "../lib/auth";
import { json, parseJsonBody } from "../lib/http";
import { logError, withHandlerLogging } from "../lib/log";
import { createPhotoBodySchema, zodErrorMessage } from "../schemas/photos";
import { uploadUrlBodySchema } from "../schemas/upload";

/**
 * Global secondary index on the photos table for listing by owner.
 *
 * Partition key: `ownerId` (Cognito `sub` or `guest#<identityId>`).
 * Sort key: `createdAt` (newest-first when `ScanIndexForward: false`).
 * Defined in `serverless.yml`.
 */
const BY_OWNER_INDEX = "byOwner";

/**
 * Build a short-lived HTTPS GET URL so the client can display a private S3 object.
 *
 * The bucket is not public; presigned URLs grant temporary read access without
 * exposing AWS credentials to the browser. `ResponseContentType` is set when
 * we can infer MIME type from the file extension (helps `<img>` and caching).
 *
 * @param s3Key - Full object key in the photos bucket (e.g. `guests/.../photos/uuid.jpg`)
 * @returns Presigned URL valid for {@link VIEW_URL_EXPIRES_SECONDS} seconds
 */
async function presignedImageUrl(s3Key: string): Promise<string> {
  // 1. Infer Content-Type from key extension (helps browsers render images).
  const responseContentType = contentTypeForS3Key(s3Key);
  // 2. Sign a time-limited GET URL for the private bucket object.
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: photosBucketName(),
      Key: s3Key,
      ...(responseContentType
        ? { ResponseContentType: responseContentType }
        : {}),
    }),
    { expiresIn: VIEW_URL_EXPIRES_SECONDS },
  );
}

/**
 * How many photo metadata rows this guest already has in DynamoDB.
 *
 * Used to enforce {@link GUEST_PHOTO_LIMIT} before upload-url and create.
 * Uses `Select: "COUNT"` so DynamoDB returns only a number, not full items.
 *
 * @param identityId - Cognito Identity Pool id from `X-Guest-Identity-Id`
 * @returns Number of photos owned by `guest#${identityId}`
 */
async function countGuestPhotos(identityId: string): Promise<number> {
  // Count rows on GSI byOwner for `guest#{identityId}` (metadata only, no full items).
  const result = await docClient.send(
    new QueryCommand({
      TableName: photosTableName(),
      IndexName: BY_OWNER_INDEX,
      KeyConditionExpression: "ownerId = :ownerId",
      ExpressionAttributeValues: {
        ":ownerId": guestOwnerId(identityId),
      },
      Select: "COUNT",
    }),
  );
  return result.Count ?? 0;
}

/**
 * Mint a presigned S3 PUT URL for a guest upload (`POST /guest/photos/upload-url`).
 *
 * **Auth:** `X-Guest-Identity-Id` header (not JWT). See {@link requireGuestIdentityId}.
 *
 * **Steps**
 * 1. Validate guest header and enforce photo count &lt; {@link GUEST_PHOTO_LIMIT}
 * 2. Parse body `{ contentType }` (e.g. `image/jpeg`)
 * 3. Allocate `photoId` (UUID) and `s3Key` under `guests/{identityId}/photos/`
 * 4. Return presigned PUT URL; client uploads file directly to S3
 *
 * **Typical client sequence**
 * Call this → `fetch(uploadUrl, { method: 'PUT', body: file })` → `create` with same `photoId`/`s3Key`.
 *
 * @param event - HTTP API v2 event (guest routes have no JWT authorizer)
 * @returns `200` with `photoId`, `s3Key`, `uploadUrl`, `expiresInSeconds`, `remainingUploads`;
 *          `403` if limit reached; `401` if header missing/invalid
 */
export const uploadUrl = withHandlerLogging("guestUploadUrl", async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  // 1. Require `X-Guest-Identity-Id` header (no JWT on guest routes).
  const auth = requireGuestIdentityId(event);
  if (!auth.ok) {
    return auth.response;
  }

  // 2. Enforce guest photo limit before minting another upload URL.
  const count = await countGuestPhotos(auth.identityId);
  if (count >= GUEST_PHOTO_LIMIT) {
    return json(403, {
      error: `Guest upload limit reached (${GUEST_PHOTO_LIMIT} photos)`,
      limit: GUEST_PHOTO_LIMIT,
      count,
    });
  }

  // 3. Parse and validate `{ contentType }` from the request body.
  const parsedBody = parseJsonBody(event.body);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = uploadUrlBodySchema.safeParse(parsedBody.value ?? {});
  if (!body.success) {
    return json(400, { error: zodErrorMessage(body.error) });
  }

  // 4. Allocate photoId and build S3 key under `guests/{identityId}/photos/`.
  const photoId = randomUUID();
  const ext = extensionForContentType(body.data.contentType);
  const s3Key = `${s3KeyPrefixForGuest(auth.identityId)}${photoId}${ext}`;

  try {
    // 5. Mint presigned PUT URL; client uploads bytes directly to S3.
    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: photosBucketName(),
        Key: s3Key,
        ContentType: body.data.contentType,
      }),
      { expiresIn: UPLOAD_URL_EXPIRES_SECONDS },
    );

    return json(200, {
      photoId,
      s3Key,
      uploadUrl,
      expiresInSeconds: UPLOAD_URL_EXPIRES_SECONDS,
      remainingUploads: GUEST_PHOTO_LIMIT - count - 1,
    });
  } catch (err) {
    logError("guestUploadUrl", "getSignedUrl failed", err);
    return json(500, { error: "Failed to create upload URL" });
  }
});

/**
 * Save guest photo metadata after S3 upload (`POST /guest/photos`).
 *
 * **Auth:** `X-Guest-Identity-Id` header.
 *
 * **Body:** `{ photoId, s3Key, caption }` — must match ids from `uploadUrl` and
 * the key the client actually uploaded to.
 *
 * **Security:** Rejects `s3Key` not under `guests/{identityId}/photos/` so a guest
 * cannot register metadata pointing at another user's (or guest's) object.
 *
 * **Server-side fields:** Sets `ownerId` to `guest#<identityId>` and `createdAt` to now.
 * Re-checks {@link GUEST_PHOTO_LIMIT} (race: two tabs could both pass upload-url).
 *
 * @param event - HTTP API v2 event with JSON body
 * @returns `201` with `{ photo, remainingUploads }`; `403` if key wrong or limit hit
 */
export const create = withHandlerLogging("guestCreate", async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  // 1. Require `X-Guest-Identity-Id` header (no JWT on guest routes).
  const auth = requireGuestIdentityId(event);
  if (!auth.ok) {
    return auth.response;
  }

  // 2. Parse and validate `{ photoId, s3Key, caption }` from the request body.
  const parsedBody = parseJsonBody(event.body);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = createPhotoBodySchema.safeParse(parsedBody.value);
  if (!body.success) {
    return json(400, { error: zodErrorMessage(body.error) });
  }

  // 3. Reject s3Key outside this guest's prefix.
  if (!isS3KeyOwnedByGuest(body.data.s3Key, auth.identityId)) {
    return json(403, {
      error: "s3Key does not belong to this guest identity",
    });
  }

  // 4. Re-check limit (race: two tabs could both pass upload-url).
  const count = await countGuestPhotos(auth.identityId);
  if (count >= GUEST_PHOTO_LIMIT) {
    return json(403, {
      error: `Guest upload limit reached (${GUEST_PHOTO_LIMIT} photos)`,
    });
  }

  // 5. Build metadata row with `guest#{identityId}` ownerId and createdAt.
  const item: PhotoItem = {
    ...body.data,
    ownerId: guestOwnerId(auth.identityId),
    createdAt: new Date().toISOString(),
  };

  try {
    // 6. Persist metadata in DynamoDB (bytes already in S3 from client PUT).
    await docClient.send(
      new PutCommand({
        TableName: photosTableName(),
        Item: item,
      }),
    );
  } catch (err) {
    logError("guestCreate", "PutItem failed", err);
    return json(500, { error: "Failed to save photo metadata" });
  }

  return json(201, {
    photo: item,
    remainingUploads: GUEST_PHOTO_LIMIT - count - 1,
  });
});

/**
 * List this guest's photos with view URLs (`GET /guest/photos`).
 *
 * **Auth:** `X-Guest-Identity-Id` header.
 *
 * Queries GSI {@link BY_OWNER_INDEX} for `ownerId = guest#<identityId>`,
 * newest first (`ScanIndexForward: false`). For each row, attaches a presigned
 * `imageUrl` (same helper as signed-in {@link photos.list}).
 *
 * Response also includes `limit` and `remainingUploads` so the UI can show
 * how many slots are left before sign-in / merge.
 *
 * @param event - HTTP API v2 event
 * @returns `200` with `{ items: PhotoListItem[], limit, remainingUploads }`
 */
export const list = withHandlerLogging("guestList", async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  // 1. Require `X-Guest-Identity-Id` header (no JWT on guest routes).
  const auth = requireGuestIdentityId(event);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    // 2. Query DynamoDB GSI byOwner for this guest's metadata (newest first).
    const result = await docClient.send(
      new QueryCommand({
        TableName: photosTableName(),
        IndexName: BY_OWNER_INDEX,
        KeyConditionExpression: "ownerId = :ownerId",
        ExpressionAttributeValues: {
          ":ownerId": guestOwnerId(auth.identityId),
        },
        ScanIndexForward: false,
      }),
    );
    const items = (result.Items ?? []) as PhotoItem[];
    // 3. Attach a presigned GET URL per row (does not fetch image bytes here).
    const itemsWithUrls: PhotoListItem[] = await Promise.all(
      items.map(async (photo) => ({
        ...photo,
        imageUrl: await presignedImageUrl(photo.s3Key),
        imageUrlExpiresInSeconds: VIEW_URL_EXPIRES_SECONDS,
      })),
    );
    // 4. Return items plus limit/remaining slots for the UI.
    return json(200, {
      items: itemsWithUrls,
      limit: GUEST_PHOTO_LIMIT,
      remainingUploads: Math.max(0, GUEST_PHOTO_LIMIT - items.length),
    });
  } catch (err) {
    logError("guestList", "Query failed", err);
    return json(500, { error: "Failed to list guest photos" });
  }
});
