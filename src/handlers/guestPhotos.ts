/**
 * Guest photo API — unauthenticated Cognito Identity Pool users (max 2 photos).
 *
 * Requires `X-Guest-Identity-Id` header (from Amplify `fetchAuthSession().identityId`).
 * Objects live under `guests/{identityId}/photos/` until `POST /photos/merge` after sign-in.
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
import { createPhotoBodySchema, zodErrorMessage } from "../schemas/photos";
import { uploadUrlBodySchema } from "../schemas/upload";

const BY_OWNER_INDEX = "byOwner";

async function presignedImageUrl(s3Key: string): Promise<string> {
  const responseContentType = contentTypeForS3Key(s3Key);
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

async function countGuestPhotos(identityId: string): Promise<number> {
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

/** `POST /guest/photos/upload-url` */
export const uploadUrl = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const auth = requireGuestIdentityId(event);
  if (!auth.ok) {
    return auth.response;
  }

  const count = await countGuestPhotos(auth.identityId);
  if (count >= GUEST_PHOTO_LIMIT) {
    return json(403, {
      error: `Guest upload limit reached (${GUEST_PHOTO_LIMIT} photos)`,
      limit: GUEST_PHOTO_LIMIT,
      count,
    });
  }

  const parsedBody = parseJsonBody(event.body);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = uploadUrlBodySchema.safeParse(parsedBody.value ?? {});
  if (!body.success) {
    return json(400, { error: zodErrorMessage(body.error) });
  }

  const photoId = randomUUID();
  const ext = extensionForContentType(body.data.contentType);
  const s3Key = `${s3KeyPrefixForGuest(auth.identityId)}${photoId}${ext}`;

  try {
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
    console.error("guest getSignedUrl failed", err);
    return json(500, { error: "Failed to create upload URL" });
  }
};

/** `POST /guest/photos` */
export const create = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const auth = requireGuestIdentityId(event);
  if (!auth.ok) {
    return auth.response;
  }

  const parsedBody = parseJsonBody(event.body);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = createPhotoBodySchema.safeParse(parsedBody.value);
  if (!body.success) {
    return json(400, { error: zodErrorMessage(body.error) });
  }

  if (!isS3KeyOwnedByGuest(body.data.s3Key, auth.identityId)) {
    return json(403, {
      error: "s3Key does not belong to this guest identity",
    });
  }

  const count = await countGuestPhotos(auth.identityId);
  if (count >= GUEST_PHOTO_LIMIT) {
    return json(403, {
      error: `Guest upload limit reached (${GUEST_PHOTO_LIMIT} photos)`,
    });
  }

  const item: PhotoItem = {
    ...body.data,
    ownerId: guestOwnerId(auth.identityId),
    createdAt: new Date().toISOString(),
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: photosTableName(),
        Item: item,
      }),
    );
  } catch (err) {
    console.error("guest PutItem failed", err);
    return json(500, { error: "Failed to save photo metadata" });
  }

  return json(201, {
    photo: item,
    remainingUploads: GUEST_PHOTO_LIMIT - count - 1,
  });
};

/** `GET /guest/photos` */
export const list = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const auth = requireGuestIdentityId(event);
  if (!auth.ok) {
    return auth.response;
  }

  try {
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
    const itemsWithUrls: PhotoListItem[] = await Promise.all(
      items.map(async (photo) => ({
        ...photo,
        imageUrl: await presignedImageUrl(photo.s3Key),
        imageUrlExpiresInSeconds: VIEW_URL_EXPIRES_SECONDS,
      })),
    );
    return json(200, {
      items: itemsWithUrls,
      limit: GUEST_PHOTO_LIMIT,
      remainingUploads: Math.max(0, GUEST_PHOTO_LIMIT - items.length),
    });
  } catch (err) {
    console.error("guest Query failed", err);
    return json(500, { error: "Failed to list guest photos" });
  }
};
