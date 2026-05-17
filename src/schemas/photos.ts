/**
 * Zod schemas for photo API request bodies.
 *
 * Validation runs in Lambda before any DynamoDB call so clients get clear 400 errors.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";

/**
 * Validates `POST /photos` JSON and normalizes defaults.
 *
 * - `caption` — required, trimmed, non-empty
 * - `photoId` — optional; generated UUID if omitted
 * - `s3Key` — optional; defaults to `pending/<photoId>` until S3 upload (step 5)
 */
export const createPhotoBodySchema = z
  .object({
    caption: z
      .string({ error: "caption is required" })
      .trim()
      .min(1, "caption is required"),
    photoId: z.string().trim().min(1).optional(),
    s3Key: z.string().trim().min(1).optional(),
  })
  .transform(({ caption, photoId, s3Key }) => {
    const id = photoId ?? randomUUID();
    return {
      photoId: id,
      s3Key: s3Key ?? `pending/${id}`,
      caption,
    };
  });

/** Output of {@link createPhotoBodySchema} after validation and transforms. */
export type CreatePhotoMetadata = z.output<typeof createPhotoBodySchema>;

/**
 * Flatten Zod validation issues into one string for API error responses.
 *
 * @param error - Result of `safeParse` when `success` is false
 * @returns Human-readable message(s), joined with `"; "`
 */
export const zodErrorMessage = (error: z.ZodError): string =>
  error.issues.map((issue) => issue.message).join("; ");
