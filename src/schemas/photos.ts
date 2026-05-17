import { randomUUID } from "node:crypto";
import { z } from "zod";

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

export type CreatePhotoMetadata = z.output<typeof createPhotoBodySchema>;

export const zodErrorMessage = (error: z.ZodError): string =>
  error.issues.map((issue) => issue.message).join("; ");
