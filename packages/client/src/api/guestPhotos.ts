import { guestApiFetch } from "../lib/api";
import { contentTypeForFile } from "../lib/contentType";
import type {
  CreatePhotoResponse,
  ImageContentType,
  ListPhotosResponse,
  PhotoItem,
  UploadUrlResponse,
} from "../types/photo";

export const guestPhotoKeys = {
  all: ["guest", "photos"] as const,
  list: (identityId: string) =>
    [...guestPhotoKeys.all, "list", identityId] as const,
};

export type GuestListPhotosResponse = ListPhotosResponse & {
  limit: number;
  remainingUploads: number;
};

export type GuestUploadUrlResponse = UploadUrlResponse & {
  remainingUploads: number;
};

export async function listGuestPhotos(
  identityId: string,
): Promise<GuestListPhotosResponse> {
  return guestApiFetch<GuestListPhotosResponse>("/guest/photos", identityId);
}

export async function requestGuestUploadUrl(
  identityId: string,
  contentType: ImageContentType,
): Promise<GuestUploadUrlResponse> {
  return guestApiFetch<GuestUploadUrlResponse>(
    "/guest/photos/upload-url",
    identityId,
    {
      method: "POST",
      body: JSON.stringify({ contentType }),
    },
  );
}

export async function createGuestPhotoMetadata(
  identityId: string,
  input: { photoId: string; s3Key: string; caption: string },
): Promise<CreatePhotoResponse & { remainingUploads: number }> {
  return guestApiFetch("/guest/photos", identityId, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function uploadGuestPhoto(
  identityId: string,
  file: File,
  caption: string,
): Promise<PhotoItem> {
  const contentType = contentTypeForFile(file);
  const { photoId, s3Key, uploadUrl } = await requestGuestUploadUrl(
    identityId,
    contentType,
  );

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error(await putRes.text());
  }

  const { photo } = await createGuestPhotoMetadata(identityId, {
    photoId,
    s3Key,
    caption,
  });
  return photo;
}
