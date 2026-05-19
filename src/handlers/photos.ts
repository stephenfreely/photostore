/**
 * Photo API — S3 for bytes, DynamoDB for metadata, Cognito for identity.
 *
 * - `uploadUrl` — `POST /photos/upload-url` — presigned PUT URL + ids (JWT required)
 * - `create`    — `POST /photos`           — save metadata after S3 upload
 * - `list`      — `GET /photos`            — list current user's photos (Query by ownerId)
 */

import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { docClient, photosTableName } from "../clients/dynamo";
import {
  extensionForContentType,
  photosBucketName,
  s3Client,
  UPLOAD_URL_EXPIRES_SECONDS,
} from "../clients/s3";
import {
  isS3KeyOwnedBy,
  requireOwnerId,
  s3KeyPrefixForOwner,
} from "../lib/auth";
import { json, parseJsonBody } from "../lib/http";
import { createPhotoBodySchema, zodErrorMessage } from "../schemas/photos";
import { uploadUrlBodySchema } from "../schemas/upload";

/** GSI name for listing photos by owner (see `serverless.yml`). */
const BY_OWNER_INDEX = "byOwner";

/**
 * One photo metadata row stored in DynamoDB.
 *
 * Image bytes live in S3 at `s3Key`; this row is the index.
 */
export type PhotoItem = {
  /** Partition key — unique id for this photo */
  photoId: string;
  /** Cognito `sub` — who owns this photo */
  ownerId: string;
  /** S3 object key under the private photos bucket */
  s3Key: string;
  /** User-visible description */
  caption: string;
  /** ISO 8601 timestamp set at write time (sort key on GSI) */
  createdAt: string;
};

/**
 * Mint a presigned S3 PUT URL (`POST /photos/upload-url`).
 *
 * Requires JWT. Object key: `users/{sub}/photos/{photoId}.jpg`.
 *
 * @param event - HTTP API event with Cognito JWT claims
 * @returns `200` with `photoId`, `s3Key`, `uploadUrl`, `expiresInSeconds`
 */
export const uploadUrl = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const auth = requireOwnerId(event);
  if (!auth.ok) {
    return auth.response;
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
  const s3Key = `${s3KeyPrefixForOwner(auth.ownerId)}${photoId}${ext}`;

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
    });
  } catch (err) {
    console.error("getSignedUrl failed", err);
    return json(500, { error: "Failed to create upload URL" });
  }
};

/**
 * Save photo metadata (`POST /photos`) after the file is in S3.
 *
 * Sets `ownerId` from JWT `sub`. Rejects `s3Key` outside `users/{sub}/photos/`.
 *
 * @param event - HTTP API event with Cognito JWT claims
 * @returns `201` with `{ photo }` on success
 */
export const create = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const auth = requireOwnerId(event);
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

  if (!isS3KeyOwnedBy(body.data.s3Key, auth.ownerId)) {
    return json(403, {
      error: "s3Key does not belong to the authenticated user",
    });
  }

  const item: PhotoItem = {
    ...body.data,
    ownerId: auth.ownerId,
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
    console.error("PutItem failed", err);
    return json(500, { error: "Failed to save photo metadata" });
  }

  return json(201, { photo: item });
};

/**
 * List the authenticated user's photos (`GET /photos`).
 *
 * Uses GSI `byOwner` (ownerId + createdAt) — not a global Scan.
 *
 * @param event - HTTP API event with Cognito JWT claims
 * @returns `200` with `{ items: PhotoItem[] }`
 */
export const list = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const auth = requireOwnerId(event);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: photosTableName(),
        IndexName: BY_OWNER_INDEX,
        KeyConditionExpression: "ownerId = :ownerId",
        ExpressionAttributeValues: { ":ownerId": auth.ownerId },
        ScanIndexForward: false,
      }),
    );
    return json(200, { items: (result.Items ?? []) as PhotoItem[] });
  } catch (err) {
    console.error("Query failed", err);
    return json(500, { error: "Failed to list photos" });
  }
};
