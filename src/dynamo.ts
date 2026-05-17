import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const photosTableName = (): string => {
  const name = process.env.PHOTOS_TABLE;
  if (!name) {
    throw new Error("PHOTOS_TABLE environment variable is not set");
  }
  return name;
};

export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
