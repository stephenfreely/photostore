import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listPhotos, photoKeys, uploadPhoto } from "../api/photos";

/** Fetches `GET /photos` for the current user; returns `items` only. */
export function usePhotos(enabled = true) {
  return useQuery({
    queryKey: photoKeys.list(),
    queryFn: listPhotos,
    select: (data) => data.items,
    enabled,
  });
}

/** Runs presign → S3 PUT → `POST /photos`; refreshes the photo list on success. */
export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption: string }) =>
      uploadPhoto(file, caption),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: photoKeys.all });
    },
  });
}
