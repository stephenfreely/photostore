/**
 * Shared DynamoDB client and table name for photo metadata.
 *
 * `PHOTOS_TABLE` is set in `serverless.yml` from the CloudFormation table ref.
 * The Lambda execution role is scoped to that table only (PutItem, GetItem, Scan).
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Resolve the DynamoDB table name from the Lambda environment.
 *
 * @returns Table name (e.g. `photostore-learn-dev-photos`)
 * @throws If `PHOTOS_TABLE` is missing (misconfigured deploy)
 */
export const photosTableName = (): string => {
  const name = process.env.PHOTOS_TABLE;
  if (!name) {
    throw new Error("PHOTOS_TABLE environment variable is not set");
  }
  return name;
};

/**
 * Document client for photo metadata (PutItem, Query, DeleteItem).
 *
 * Works with plain JS objects instead of low-level AttributeValue maps.
 * Reused across invocations when Lambda reuses the execution environment.
 */
export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
