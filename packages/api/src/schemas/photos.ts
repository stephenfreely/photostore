/**
 * Zod schemas for photo API request bodies.
 *
 * Validation runs in Lambda before any DynamoDB call so clients get clear 400 errors.
 */

import { z } from "zod";

/**
 * Validates `POST /photos` JSON after the client has uploaded to S3.
 *
 * - `caption` — required, trimmed, non-empty
 * - `photoId` — required; must match the id from `POST /photos/upload-url`
 * - `s3Key` — required; must match the key from `POST /photos/upload-url`
 */
export const createPhotoBodySchema = z.object({
  caption: z
    .string({ error: "caption is required" })
    .trim()
    .min(1, "caption is required"),
  photoId: z.string().trim().min(1, "photoId is required"),
  s3Key: z.string().trim().min(1, "s3Key is required"),
});

/** Output of {@link createPhotoBodySchema} after validation. */
export type CreatePhotoMetadata = z.output<typeof createPhotoBodySchema>;

/**
 * Flatten Zod validation issues into one string for API error responses.
 *
 * @param error - Result of `safeParse` when `success` is false
 * @returns Human-readable message(s), joined with `"; "`
 */
export const zodErrorMessage = (error: z.ZodError): string =>
  error.issues.map((issue) => issue.message).join("; ");
