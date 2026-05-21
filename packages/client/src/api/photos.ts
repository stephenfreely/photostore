import { apiFetch } from "../lib/api";
import { contentTypeForFile } from "../lib/contentType";
import type {
  CreatePhotoResponse,
  ImageContentType,
  ListPhotosResponse,
  PhotoItem,
  UploadUrlResponse,
} from "../types/photo";

/** TanStack Query keys for photo list and mutations. */
export const photoKeys = {
  all: ["photos"] as const,
  list: () => [...photoKeys.all, "list"] as const,
};

/**
 * List the signed-in user's photos (`GET /photos`).
 *
 * Backend queries DynamoDB GSI `byOwner` and attaches a presigned S3 GET
 * `imageUrl` per item (see `photos.list` in photostore).
 */
export async function listPhotos(): Promise<ListPhotosResponse> {
  return apiFetch<ListPhotosResponse>("/photos");
}

/**
 * Request a presigned S3 PUT URL (`POST /photos/upload-url`).
 *
 * Backend generates `photoId`, builds `s3Key` under `users/{sub}/photos/`,
 * and returns `uploadUrl` + `expiresInSeconds` (see `photos.uploadUrl`).
 */
export async function requestUploadUrl(
  contentType: ImageContentType,
): Promise<UploadUrlResponse> {
  return apiFetch<UploadUrlResponse>("/photos/upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType }),
  });
}

/**
 * Save photo metadata after bytes are in S3 (`POST /photos`).
 *
 * Backend sets `ownerId` from the JWT `sub`, validates `s3Key` belongs to
 * that user, and writes the row to DynamoDB (see `photos.create`).
 */
export async function createPhotoMetadata(input: {
  photoId: string;
  s3Key: string;
  caption: string;
}): Promise<CreatePhotoResponse> {
  return apiFetch<CreatePhotoResponse>("/photos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * End-to-end upload: presign → PUT file to S3 → save metadata.
 *
 * Matches the backend flow in photostore README: (1) `upload-url`, (2) direct
 * `PUT` to S3 (no JWT), (3) `POST /photos`.
 */
export async function uploadPhoto(file: File, caption: string): Promise<PhotoItem> {
  const contentType = contentTypeForFile(file);

  const { photoId, s3Key, uploadUrl } = await requestUploadUrl(contentType);

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error(await putRes.text());
  }

  const { photo } = await createPhotoMetadata({ photoId, s3Key, caption });
  return photo;
}

export type MergePhotosResponse = {
  mergedCount: number;
  photos: PhotoItem[];
};

/**
 * Attach guest uploads to the signed-in user (`POST /photos/merge`).
 *
 * Call after sign-in with the identity id captured before login.
 */
export async function mergeGuestPhotos(
  guestIdentityId: string,
): Promise<MergePhotosResponse> {
  return apiFetch<MergePhotosResponse>("/photos/merge", {
    method: "POST",
    body: JSON.stringify({ guestIdentityId }),
  });
}
