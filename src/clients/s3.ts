/**
 * S3 client and bucket name for photo file storage.
 *
 * `PHOTOS_BUCKET` is set in `serverless.yml` from the CloudFormation bucket ref.
 * Objects are private; clients upload via presigned PUT URLs minted by Lambda.
 *
 * @see README — “S3 presigned URLs (how upload signing works)”
 */

import { S3Client } from "@aws-sdk/client-s3";

/**
 * How long presigned upload URLs remain valid (seconds).
 * Passed to `getSignedUrl` as `expiresIn`; S3 rejects PUTs after this window.
 */
export const UPLOAD_URL_EXPIRES_SECONDS = 300;

/**
 * How long presigned view URLs remain valid (seconds).
 * Returned on each item from `GET /photos` as `imageUrlExpiresInSeconds`.
 */
export const VIEW_URL_EXPIRES_SECONDS = 3600;

/** Maps allowed `Content-Type` values to file extensions in S3 keys. */
/** Infer `Content-Type` from an S3 key extension (for presigned GET responses). */
export const contentTypeForS3Key = (s3Key: string): string | undefined => {
  if (s3Key.endsWith(".jpg") || s3Key.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (s3Key.endsWith(".png")) {
    return "image/png";
  }
  if (s3Key.endsWith(".webp")) {
    return "image/webp";
  }
  return undefined;
};

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
