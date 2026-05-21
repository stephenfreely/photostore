import { usePhotos } from "../hooks/usePhotos";
import { PhotoGallerySkeleton } from "./ui/Skeleton";

type PhotoGalleryProps = {
  enabled?: boolean;
};

export function PhotoGallery({ enabled = true }: PhotoGalleryProps) {
  const photos = usePhotos(enabled);

  if (photos.isLoading) {
    return <PhotoGallerySkeleton />;
  }

  if (photos.isError) {
    return (
      <p className="m-0 text-sm text-error" role="alert">
        {photos.error instanceof Error ? photos.error.message : "Failed to load photos"}
      </p>
    );
  }

  if (!photos.data?.length) {
    return <p className="m-0 text-muted">No photos yet. Upload one above.</p>;
  }

  return (
    <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface-elevated p-5">
      <h2 className="mb-1.5 text-lg leading-tight">Your photos</h2>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {photos.data.map((photo) => (
          <li
            key={photo.photoId}
            className="flex items-center justify-between gap-4 border-b border-border pb-3.5 last:border-b-0 last:pb-0"
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
              <p className="m-0 break-all font-mono text-sm text-muted">{photo.s3Key}</p>
            </div>
            <time className="shrink-0 text-sm whitespace-nowrap text-muted" dateTime={photo.createdAt}>
              {new Date(photo.createdAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
