/**
 * Zod schema for `POST /photos/merge` (move guest photos to signed-in user).
 */

import { z } from "zod";

/**
 * Validates `POST /photos/merge` request body.
 *
 * `guestIdentityId` is the Cognito Identity Pool id from the **pre-login**
 * `fetchAuthSession().identityId` (format `region:uuid`). It must match the id
 * used in `X-Guest-Identity-Id` during guest uploads so the handler can find
 * rows where `ownerId = guest#{guestIdentityId}`.
 */
export const mergePhotosBodySchema = z.object({
  guestIdentityId: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9-]+:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i,
      "guestIdentityId must be a Cognito identity id (region:uuid)",
    ),
});

/** Output of {@link mergePhotosBodySchema} after validation. */
export type MergePhotosBody = z.output<typeof mergePhotosBodySchema>;
