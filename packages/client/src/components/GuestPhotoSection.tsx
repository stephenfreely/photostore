import { useEffect, useState, type FormEvent } from "react";
import { guestPhotoLimit } from "../lib/env";
import { trackGuestIdentityForMerge } from "../lib/guestIdentity";
import { useGuestIdentity } from "../hooks/useGuestIdentity";
import { useGuestPhotos, useUploadGuestPhoto } from "../hooks/useGuestPhotos";

export function GuestPhotoSection() {
  const identity = useGuestIdentity(true);
  const identityId = identity.data;
  const photos = useGuestPhotos(identityId);
  const upload = useUploadGuestPhoto(identityId);

  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);

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
          setCaption("");
          setFile(null);
        },
      },
    );
  }

  if (identity.isLoading) {
    return <p className="muted">Preparing guest session…</p>;
  }

  if (identity.isError) {
    return (
      <p className="error" role="alert">
        {identity.error instanceof Error
          ? identity.error.message
          : "Could not start guest session"}
      </p>
    );
  }

  return (
    <section className="grid">
      <form className="card" onSubmit={handleSubmit}>
        <h2>Try before you sign in</h2>
        <p className="muted">
          Upload up to {guestPhotoLimit} photos as a guest. After you sign in,
          they merge into your account.
        </p>
        <p className="status-pill">
          {atLimit
            ? "Guest limit reached — sign in to keep uploading"
            : `${remaining} guest upload${remaining === 1 ? "" : "s"} left`}
        </p>

        <label>
          Image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={atLimit || upload.isPending}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required={!atLimit}
          />
        </label>

        <label>
          Caption
          <input
            type="text"
            value={caption}
            disabled={atLimit || upload.isPending}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Beach sunset"
            required={!atLimit}
          />
        </label>

        {upload.isError && (
          <p className="error" role="alert">
            {upload.error instanceof Error
              ? upload.error.message
              : "Upload failed"}
          </p>
        )}

        {upload.isSuccess && <p className="success">Guest photo uploaded.</p>}

        <button type="submit" disabled={upload.isPending || !file || atLimit}>
          {upload.isPending ? "Uploading…" : "Upload as guest"}
        </button>
      </form>

      {photos.isSuccess && photos.data.items.length > 0 && (
        <div className="card">
          <h2>Your guest photos</h2>
          <ul className="photo-list">
            {photos.data.items.map((photo) => (
              <li key={photo.photoId}>
                <img
                  className="photo-thumb"
                  src={photo.imageUrl}
                  alt={photo.caption || "Photo"}
                  loading="lazy"
                  width={120}
                  height={120}
                />
                <div className="photo-meta">
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
