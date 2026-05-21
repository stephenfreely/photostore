import { useRef, useState, type FormEvent } from "react";
import { useUploadPhoto } from "../hooks/usePhotos";

export function PhotoUpload() {
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadPhoto();

  function clearForm() {
    setCaption("");
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;

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

  return (
    <form
      className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface-elevated p-5"
      onSubmit={handleSubmit}
    >
      <h2 className="mb-1.5 text-lg leading-tight">Upload photo</h2>
      <p className="m-0 text-muted">
        Presigned URL → S3 PUT → save metadata (same flow as the backend README).
      </p>

      <label className="flex flex-col gap-1.5 text-sm text-label">
        Image
        <input
          ref={fileInputRef}
          className="w-full rounded-lg border border-border-input bg-surface px-3 py-2.5 font-[inherit] text-inherit"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-label">
        Caption
        <input
          className="w-full rounded-lg border border-border-input bg-surface px-3 py-2.5 font-[inherit] text-inherit"
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Beach sunset"
          required
        />
      </label>

      {upload.isError && (
        <p className="m-0 text-sm text-error" role="alert">
          {upload.error instanceof Error ? upload.error.message : "Upload failed"}
        </p>
      )}

      {upload.isSuccess && <p className="m-0 text-sm text-success">Photo uploaded.</p>}

      <button
        type="submit"
        className="cursor-pointer rounded-lg bg-accent px-4 py-2.5 font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-60"
        disabled={upload.isPending || !file}
      >
        {upload.isPending ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
