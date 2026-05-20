import type { ImageContentType } from "../types/photo";

export function contentTypeForFile(file: File): ImageContentType {
  if (file.type === "image/png") return "image/png";
  if (file.type === "image/webp") return "image/webp";
  return "image/jpeg";
}
