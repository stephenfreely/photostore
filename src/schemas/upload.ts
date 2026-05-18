/**
 * Zod schema for `POST /photos/upload-url`.
 */

import { z } from "zod";

/** Allowed image MIME types for direct-to-S3 uploads. */
export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * Validates upload-url request body.
 *
 * - `contentType` — optional; defaults to `image/jpeg`
 */
export const uploadUrlBodySchema = z.object({
  contentType: z
    .enum(ALLOWED_IMAGE_CONTENT_TYPES)
    .optional()
    .default("image/jpeg"),
});

export type UploadUrlBody = z.output<typeof uploadUrlBodySchema>;
