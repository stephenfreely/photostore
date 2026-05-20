import { z } from "zod";

/** Validates `POST /photos/merge` — link guest uploads to the signed-in user. */
export const mergePhotosBodySchema = z.object({
  guestIdentityId: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9-]+:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i,
      "guestIdentityId must be a Cognito identity id (region:uuid)",
    ),
});

export type MergePhotosBody = z.output<typeof mergePhotosBodySchema>;
