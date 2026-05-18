/**
 * Photo API — S3 for bytes, DynamoDB for metadata.
 *
 * - `uploadUrl` — `POST /photos/upload-url` — presigned PUT URL + ids
 * - `create`    — `POST /photos`           — save metadata after S3 upload
 * - `list`      — `GET /photos`            — list metadata (Scan; learning only)
 */

import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { docClient, photosTableName } from "./dynamo";
import { json, parseJsonBody } from "./http";
import {
  createPhotoBodySchema,
  zodErrorMessage,
} from "./schemas/photos";
import { uploadUrlBodySchema } from "./schemas/upload";
import {
  extensionForContentType,
  photosBucketName,
  s3Client,
  UPLOAD_URL_EXPIRES_SECONDS,
} from "./s3";

/**
 * One photo metadata row stored in DynamoDB.
 *
 * Image bytes live in S3 at `s3Key`; this row is the index.
 */
export type PhotoItem = {
  /** Partition key — unique id for this photo */
  photoId: string;
  /** S3 object key under the private photos bucket */
  s3Key: string;
  /** User-visible description */
  caption: string;
  /** ISO 8601 timestamp set at write time */
  createdAt: string;
};

/**
 * Mint a presigned S3 PUT URL (`POST /photos/upload-url`).
 *
 * Flow:
 * 1. Client sends optional `{ "contentType": "image/jpeg" }`
 * 2. Lambda generates `photoId`, `s3Key` (`photos/{photoId}.jpg`, etc.)
 * 3. Returns `uploadUrl` — client PUTs file bytes directly to S3 (not via API Gateway)
 * 4. Client then calls {@link create} with the same `photoId` and `s3Key`
 *
 * @param event - HTTP API event; body may be `{}` or include `contentType`
 * @returns `200` with `photoId`, `s3Key`, `uploadUrl`, `expiresInSeconds`
 */
export const uploadUrl = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
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
  const s3Key = `photos/${photoId}${ext}`;

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
 * Call {@link uploadUrl} first, PUT the file to S3, then POST here with the
 * returned `photoId` and `s3Key` plus a `caption`.
 *
 * @param event - HTTP API event; `event.body` must be JSON
 * @returns `201` with `{ photo }` on success; `400` for validation errors; `500` on DynamoDB failure
 */
export const create = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const parsedBody = parseJsonBody(event.body);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = createPhotoBodySchema.safeParse(parsedBody.value);
  if (!body.success) {
    return json(400, { error: zodErrorMessage(body.error) });
  }

  const item: PhotoItem = {
    ...body.data,
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
 * List all photo metadata (`GET /photos`).
 *
 * Uses `Scan` on the whole table — simple for learning, but reads every item.
 * Later steps will use `Query` + `ownerId` once Cognito auth is added.
 *
 * @returns `200` with `{ items: PhotoItem[] }`; `500` if DynamoDB fails
 */
export const list = async (): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const result = await docClient.send(
      new ScanCommand({ TableName: photosTableName() }),
    );
    return json(200, { items: (result.Items ?? []) as PhotoItem[] });
  } catch (err) {
    console.error("Scan failed", err);
    return json(500, { error: "Failed to list photos" });
  }
};
