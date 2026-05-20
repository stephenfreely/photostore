export type ImageContentType = "image/jpeg" | "image/png" | "image/webp";

export type PhotoItem = {
  photoId: string;
  ownerId: string;
  s3Key: string;
  caption: string;
  createdAt: string;
};

/** Row from `GET /photos` — metadata plus a presigned view URL. */
export type PhotoListItem = PhotoItem & {
  imageUrl: string;
  imageUrlExpiresInSeconds: number;
};

export type UploadUrlResponse = {
  photoId: string;
  s3Key: string;
  uploadUrl: string;
  expiresInSeconds: number;
};

export type ListPhotosResponse = {
  items: PhotoListItem[];
};

export type CreatePhotoResponse = {
  photo: PhotoItem;
};

export type HelloResponse = {
  message: string;
  routeKey?: string;
};
