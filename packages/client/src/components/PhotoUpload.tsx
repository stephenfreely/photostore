import { useState, type FormEvent } from "react";
import { useUploadPhoto } from "../hooks/usePhotos";

export function PhotoUpload() {
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadPhoto();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;

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

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Upload photo</h2>
      <p className="muted">
        Presigned URL → S3 PUT → save metadata (same flow as the backend README).
      </p>

      <label>
        Image
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
      </label>

      <label>
        Caption
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Beach sunset"
          required
        />
      </label>

      {upload.isError && (
        <p className="error" role="alert">
          {upload.error instanceof Error ? upload.error.message : "Upload failed"}
        </p>
      )}

      {upload.isSuccess && <p className="success">Photo uploaded.</p>}

      <button type="submit" disabled={upload.isPending || !file}>
        {upload.isPending ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
