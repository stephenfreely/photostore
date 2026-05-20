import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  guestPhotoKeys,
  listGuestPhotos,
  uploadGuestPhoto,
} from "../api/guestPhotos";
import { trackGuestIdentityForMerge } from "../lib/guestIdentity";

export function useGuestPhotos(identityId: string | undefined) {
  return useQuery({
    queryKey: guestPhotoKeys.list(identityId ?? ""),
    queryFn: () => listGuestPhotos(identityId!),
    select: (data) => data,
    enabled: Boolean(identityId),
  });
}

export function useUploadGuestPhoto(identityId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption: string }) =>
      uploadGuestPhoto(identityId!, file, caption),
    onSuccess: () => {
      if (identityId) {
        trackGuestIdentityForMerge(identityId);
        void queryClient.invalidateQueries({
          queryKey: guestPhotoKeys.list(identityId),
        });
      }
    },
  });
}
