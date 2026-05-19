/**
 * Cognito JWT claims from API Gateway HTTP API JWT authorizer (step 7).
 *
 * API Gateway validates the token before Lambda runs; claims are on the event.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { json } from "./http";

/** JWT claims on HTTP API events when `cognitoJwt` authorizer is attached. */
type JwtAuthorizerContext = {
  jwt?: { claims?: Record<string, string> };
};

/**
 * Cognito user id from JWT `sub` claim.
 *
 * @returns `sub` string, or `null` if missing (should not happen when route uses JWT authorizer)
 */
export const getOwnerId = (event: APIGatewayProxyEventV2): string | null => {
  const ctx = event.requestContext as APIGatewayProxyEventV2["requestContext"] &
    JwtAuthorizerContext;
  const sub = ctx?.jwt?.claims?.sub;
  return typeof sub === "string" && sub.length > 0 ? sub : null;
};

/**
 * Require a logged-in user (`sub`) for handlers that scope data by owner.
 */
export const requireOwnerId = (
  event: APIGatewayProxyEventV2,
):
  | { ok: true; ownerId: string }
  | { ok: false; response: APIGatewayProxyStructuredResultV2 } => {
  const ownerId = getOwnerId(event);
  if (!ownerId) {
    return { ok: false, response: json(401, { error: "Unauthorized" }) };
  }
  return { ok: true, ownerId };
};

/** S3 key prefix for a user's photos: `users/{sub}/photos/`. */
export const s3KeyPrefixForOwner = (ownerId: string): string =>
  `users/${ownerId}/photos/`;

/**
 * Ensure `s3Key` belongs to this user (prevents saving metadata for another user's object).
 */
export const isS3KeyOwnedBy = (s3Key: string, ownerId: string): boolean =>
  s3Key.startsWith(s3KeyPrefixForOwner(ownerId));
