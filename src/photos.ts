import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { docClient, photosTableName } from "./dynamo";
import { json } from "./http";
import { createPhotoBodySchema, zodErrorMessage } from "./schemas/photos";

export type PhotoItem = {
  photoId: string;
  s3Key: string;
  caption: string;
  createdAt: string;
};

/** POST /photos — write photo metadata (no file upload yet). */
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

/** GET /photos — list all metadata rows (Scan; fine for learning). */
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
