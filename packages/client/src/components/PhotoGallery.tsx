import { usePhotos } from "../hooks/usePhotos";

type PhotoGalleryProps = {
  enabled?: boolean;
};

export function PhotoGallery({ enabled = true }: PhotoGalleryProps) {
  const photos = usePhotos(enabled);

  if (photos.isLoading) {
    return <p className="muted">Loading your photos…</p>;
  }

  if (photos.isError) {
    return (
      <p className="error" role="alert">
        {photos.error instanceof Error ? photos.error.message : "Failed to load photos"}
      </p>
    );
  }

  if (!photos.data?.length) {
    return <p className="muted">No photos yet. Upload one above.</p>;
  }

  return (
    <section className="card">
      <h2>Your photos</h2>
      <ul className="photo-list">
        {photos.data.map((photo) => (
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
              <p className="muted mono">{photo.s3Key}</p>
            </div>
            <time dateTime={photo.createdAt}>
              {new Date(photo.createdAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
