/**
 * S3 client and bucket name for photo file storage.
 *
 * `PHOTOS_BUCKET` is set in `serverless.yml` from the CloudFormation bucket ref.
 * Objects are private; clients upload via presigned PUT URLs minted by Lambda.
 */

import { S3Client } from "@aws-sdk/client-s3";

/** How long presigned upload URLs remain valid (seconds). */
export const UPLOAD_URL_EXPIRES_SECONDS = 300;

/** Maps allowed `Content-Type` values to file extensions in S3 keys. */
export const extensionForContentType = (contentType: string): string => {
  switch (contentType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
};

/**
 * Resolve the photos bucket name from the Lambda environment.
 *
 * @returns Bucket name (assigned by CloudFormation at deploy time)
 * @throws If `PHOTOS_BUCKET` is missing (misconfigured deploy)
 */
export const photosBucketName = (): string => {
  const name = process.env.PHOTOS_BUCKET;
  if (!name) {
    throw new Error("PHOTOS_BUCKET environment variable is not set");
  }
  return name;
};

/** Reused across invocations (Lambda container reuse). */
export const s3Client = new S3Client({});
