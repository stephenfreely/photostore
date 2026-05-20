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
 * @param event - HTTP API event after JWT authorizer ran on the route
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
 *
 * @param event - HTTP API event (must have passed JWT authorizer on the route)
 * @returns `{ ok: true, ownerId }` or `{ ok: false, response }` with `401` JSON
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

/**
 * Max photos a guest (unauthenticated identity) may upload before sign-in.
 *
 * Enforced in `guestPhotos` upload-url and create handlers.
 */
export const GUEST_PHOTO_LIMIT = 2;

/**
 * S3 key prefix for a signed-in user's photos.
 *
 * All authenticated uploads and merge targets use keys under `users/{sub}/photos/`.
 *
 * @param ownerId - Cognito JWT `sub` (same value stored as DynamoDB `ownerId`)
 * @returns Prefix string ending with `/` (e.g. `users/abc-123/photos/`)
 */
export const s3KeyPrefixForOwner = (ownerId: string): string =>
  `users/${ownerId}/photos/`;

/**
 * DynamoDB `ownerId` value for a guest's metadata rows.
 *
 * Guests are not in the User Pool yet; we namespace rows as `guest#{identityId}`.
 *
 * @param identityId - Cognito Identity Pool id (`region:uuid`)
 * @returns Owner id for GSI queries and PutItem (e.g. `guest#us-east-1:...`)
 */
export const guestOwnerId = (identityId: string): string => `guest#${identityId}`;

/**
 * S3 key prefix for a guest's photo objects (before merge).
 *
 * @param identityId - Cognito Identity Pool id from `X-Guest-Identity-Id`
 * @returns Prefix string ending with `/` (e.g. `guests/us-east-1:uuid/photos/`)
 */
export const s3KeyPrefixForGuest = (identityId: string): string =>
  `guests/${identityId}/photos/`;

/**
 * Ensure `s3Key` belongs to this signed-in user.
 *
 * Prevents `POST /photos` from saving metadata for another user's S3 object.
 *
 * @param s3Key - Object key from the upload-url step
 * @param ownerId - JWT `sub` for the current request
 * @returns `true` if `s3Key` starts with `users/{ownerId}/photos/`
 */
export const isS3KeyOwnedBy = (s3Key: string, ownerId: string): boolean =>
  s3Key.startsWith(s3KeyPrefixForOwner(ownerId));

/**
 * Ensure `s3Key` is under this guest's prefix.
 *
 * Prevents one guest from registering metadata for another guest's object.
 *
 * @param s3Key - Object key from the guest upload-url step
 * @param identityId - Value from `X-Guest-Identity-Id`
 * @returns `true` if `s3Key` starts with `guests/{identityId}/photos/`
 */
export const isS3KeyOwnedByGuest = (s3Key: string, identityId: string): boolean =>
  s3Key.startsWith(s3KeyPrefixForGuest(identityId));

/** HTTP header name for Cognito Identity Pool id on guest routes (case-insensitive). */
export const GUEST_IDENTITY_HEADER = "x-guest-identity-id";

/** Cognito identity ids: `region:uuid` (with or without hyphens in the uuid). */
const GUEST_IDENTITY_ID_PATTERN =
  /^[a-z0-9-]+:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i;

/**
 * Cognito Identity Pool id from request header (e.g. `us-east-1:uuid`).
 *
 * Client obtains this via Amplify `fetchAuthSession()` before sign-in.
 *
 * @param event - HTTP API event; header lookup is case-insensitive
 * @returns Trimmed `region:uuid` string, or `null` if missing or invalid format
 */
export const getGuestIdentityId = (
  event: APIGatewayProxyEventV2,
): string | null => {
  // 1. Find header case-insensitively (API Gateway may vary casing).
  const headers = event.headers ?? {};
  const entry = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === GUEST_IDENTITY_HEADER,
  );
  const value = entry?.[1];
  if (typeof value !== "string") return null;
  // 2. Accept only Cognito identity id shape (`region:uuid`).
  const trimmed = value.trim();
  if (!GUEST_IDENTITY_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
};

/**
 * Require a valid guest identity header for unauthenticated photo routes.
 *
 * @param event - HTTP API event (guest routes have no JWT authorizer)
 * @returns `{ ok: true, identityId }` or `{ ok: false, response }` with `401` JSON
 */
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
