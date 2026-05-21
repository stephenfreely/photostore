import { useEffect, useRef, useState, type FormEvent } from "react";
import { guestPhotoLimit } from "../lib/env";
import { trackGuestIdentityForMerge } from "../lib/guestIdentity";
import { useGuestIdentity } from "../hooks/useGuestIdentity";
import { useGuestPhotos, useUploadGuestPhoto } from "../hooks/useGuestPhotos";
import { CardSkeleton, PhotoGallerySkeleton } from "./ui/Skeleton";

export function GuestPhotoSection() {
  const identity = useGuestIdentity(true);
  const identityId = identity.data;
  const photos = useGuestPhotos(identityId);
  const upload = useUploadGuestPhoto(identityId);

  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function clearForm() {
    setCaption("");
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const remaining =
    photos.data?.remainingUploads ??
    guestPhotoLimit - (photos.data?.items.length ?? 0);
  const atLimit = remaining <= 0;

  useEffect(() => {
    if (identityId && photos.data && photos.data.items.length > 0) {
      trackGuestIdentityForMerge(identityId);
    }
  }, [identityId, photos.data]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || atLimit) return;

    upload.mutate(
      { file, caption },
      {
        onSuccess: () => {
          clearForm();
          upload.reset();
        },
      },
    );
  }

  if (identity.isLoading) {
    return (
      <section className="grid gap-5">
        <CardSkeleton fieldCount={2} />
      </section>
    );
  }

  if (identity.isError) {
    return (
      <p className="m-0 text-sm text-error" role="alert">
        {identity.error instanceof Error
          ? identity.error.message
          : "Could not start guest session"}
      </p>
    );
  }

  return (
    <section className="grid gap-5">
      <form
        className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface-elevated p-5"
        onSubmit={handleSubmit}
      >
        <h2 className="mb-1.5 text-lg leading-tight">Try before you sign in</h2>
        <p className="m-0 text-muted">
          Upload up to {guestPhotoLimit} photos as a guest. After you sign in,
          they merge into your account.
        </p>
        <p className="m-0 inline-block w-fit rounded-full bg-success-muted px-2.5 py-1 text-sm text-success">
          {atLimit
            ? "Guest limit reached — sign in to keep uploading"
            : `${remaining} guest upload${remaining === 1 ? "" : "s"} left`}
        </p>

        <label className="flex flex-col gap-1.5 text-sm text-label">
          Image
          <input
            ref={fileInputRef}
            className="w-full rounded-lg border border-border-input bg-surface px-3 py-2.5 font-[inherit] text-inherit disabled:cursor-not-allowed disabled:opacity-60"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={atLimit || upload.isPending}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required={!atLimit}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-label">
          Caption
          <input
            className="w-full rounded-lg border border-border-input bg-surface px-3 py-2.5 font-[inherit] text-inherit disabled:cursor-not-allowed disabled:opacity-60"
            type="text"
            value={caption}
            disabled={atLimit || upload.isPending}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Beach sunset"
            required={!atLimit}
          />
        </label>

        {upload.isError && (
          <p className="m-0 text-sm text-error" role="alert">
            {upload.error instanceof Error
              ? upload.error.message
              : "Upload failed"}
          </p>
        )}

        {upload.isSuccess && <p className="m-0 text-sm text-success">Guest photo uploaded.</p>}

        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-accent px-4 py-2.5 font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-60"
          disabled={upload.isPending || !file || atLimit}
        >
          {upload.isPending ? "Uploading…" : "Upload as guest"}
        </button>
      </form>

      {photos.isLoading && <PhotoGallerySkeleton rows={2} />}

      {photos.isSuccess && photos.data.items.length > 0 && (
        <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface-elevated p-5">
          <h2 className="mb-1.5 text-lg leading-tight">Your guest photos</h2>
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {photos.data.items.map((photo) => (
              <li
                key={photo.photoId}
                className="flex items-center gap-4 border-b border-border pb-3.5 last:border-b-0 last:pb-0"
              >
                <img
                  className="size-[120px] shrink-0 rounded-lg bg-surface-thumb object-cover"
                  src={photo.imageUrl}
                  alt={photo.caption || "Photo"}
                  loading="lazy"
                  width={120}
                  height={120}
                />
                <div className="min-w-0 flex-1">
                  <strong>{photo.caption}</strong>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
