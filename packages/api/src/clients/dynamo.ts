/**
 * Shared DynamoDB client and table name for photo metadata.
 *
 * `PHOTOS_TABLE` is set in `serverless.yml` from the CloudFormation table ref.
 * The Lambda execution role is scoped to that table (+ GSI `byOwner`) only.
 *
 * ## AWS SDK v3 Command pattern
 *
 * Handlers call `docClient.send(new SomeCommand({ ... }))`. The **Command** object
 * describes one DynamoDB API request; `.send()` executes it with the Lambda role.
 *
 * Commands from `@aws-sdk/lib-dynamodb` (plain JS objects, not low-level AttributeValue maps):
 *
 * | Command        | DynamoDB API | Used for in this app                                      |
 * | -------------- | ------------ | --------------------------------------------------------- |
 * | `QueryCommand` | Query        | List photos for one `ownerId` via GSI `byOwner`           |
 * | `PutCommand`   | PutItem      | Save photo metadata after S3 upload; rewrite on merge     |
 * | `DeleteCommand`| DeleteItem   | Remove old guest row during merge                         |
 *
 * @see README — “AWS SDK commands”
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
