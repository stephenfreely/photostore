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
  authorizer?: { jwt?: { claims?: Record<string, string> } };
};

/**
 * Cognito user id from JWT `sub` (subject) claim.
 *
 * `sub` is the stable per-user id in the User Pool. We use it as `ownerId` in DynamoDB/S3.
 * See README: "What is sub? (and ownerId)".
 *
 * @returns `sub` string, or `null` if missing (should not happen when route uses JWT authorizer)
 */
export const getOwnerId = (event: APIGatewayProxyEventV2): string | null => {
  const ctx = event.requestContext as APIGatewayProxyEventV2["requestContext"] &
    JwtAuthorizerContext;
  const sub = ctx?.authorizer?.jwt?.claims?.sub;
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

/** Max photos a guest (unauthenticated identity) may upload before sign-in. */
export const GUEST_PHOTO_LIMIT = 2;

/** S3 key prefix for a user's photos: `users/{sub}/photos/`. */
export const s3KeyPrefixForOwner = (ownerId: string): string =>
  `users/${ownerId}/photos/`;

/** DynamoDB `ownerId` for guest rows — `guest#{identityPoolIdentityId}`. */
export const guestOwnerId = (identityId: string): string => `guest#${identityId}`;

/** S3 key prefix for guest photos: `guests/{identityId}/photos/`. */
export const s3KeyPrefixForGuest = (identityId: string): string =>
  `guests/${identityId}/photos/`;

/**
 * Ensure `s3Key` belongs to this user (prevents saving metadata for another user's object).
 */
export const isS3KeyOwnedBy = (s3Key: string, ownerId: string): boolean =>
  s3Key.startsWith(s3KeyPrefixForOwner(ownerId));

/** Ensure `s3Key` is under the guest's prefix. */
export const isS3KeyOwnedByGuest = (s3Key: string, identityId: string): boolean =>
  s3Key.startsWith(s3KeyPrefixForGuest(identityId));

export const GUEST_IDENTITY_HEADER = "x-guest-identity-id";

/** Cognito identity ids: `region:uuid` (with or without hyphens in the uuid). */
const GUEST_IDENTITY_ID_PATTERN =
  /^[a-z0-9-]+:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i;

/**
 * Cognito Identity Pool id from request header (e.g. `us-east-1:uuid`).
 *
 * Client obtains this via Amplify `fetchAuthSession()` before sign-in.
 */
export const getGuestIdentityId = (
  event: APIGatewayProxyEventV2,
): string | null => {
  const headers = event.headers ?? {};
  const entry = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === GUEST_IDENTITY_HEADER,
  );
  const value = entry?.[1];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!GUEST_IDENTITY_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
};

export const requireGuestIdentityId = (
  event: APIGatewayProxyEventV2,
):
  | { ok: true; identityId: string }
  | { ok: false; response: APIGatewayProxyStructuredResultV2 } => {
  const identityId = getGuestIdentityId(event);
  if (!identityId) {
    return {
      ok: false,
      response: json(401, {
        error: `Missing or invalid ${GUEST_IDENTITY_HEADER} header`,
      }),
    };
  }
  return { ok: true, identityId };
};
