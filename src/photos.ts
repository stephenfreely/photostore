/**
 * Photo metadata API — DynamoDB only (no S3 bytes yet).
 *
 * - `create` — `POST /photos` — write one row
 * - `list`   — `GET /photos`  — read all rows via Scan (learning step; not for production scale)
 */

import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { docClient, photosTableName } from "./dynamo";
import { json } from "./http";
import { createPhotoBodySchema, zodErrorMessage } from "./schemas/photos";

/**
 * One photo metadata row stored in DynamoDB.
 *
 * Image bytes live in S3 later; this row is the index (id, key, caption, time).
 */
export type PhotoItem = {
  /** Partition key — unique id for this photo */
  photoId: string;
  /** S3 object key (placeholder `pending/...` until upload flow exists) */
  s3Key: string;
  /** User-visible description */
  caption: string;
  /** ISO 8601 timestamp set at write time */
  createdAt: string;
};

/**
 * Create photo metadata (`POST /photos`).
 *
 * Flow:
 * 1. Require a JSON body
 * 2. Parse JSON, then validate with {@link createPhotoBodySchema}
 * 3. Add `createdAt` and `PutItem` to DynamoDB
 *
 * Does not upload files — only stores metadata. Real `s3Key` values come in step 5.
 *
 * @param event - HTTP API event; `event.body` must be JSON
 * @returns `201` with `{ photo }` on success; `400` for validation errors; `500` on DynamoDB failure
 */
export const create = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  if (!event.body) {
    return json(400, { error: "Request body is required" });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const body = createPhotoBodySchema.safeParse(parsed);
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
