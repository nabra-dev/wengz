import { API_URL } from "./config";
import { detectFileKind } from "./file-kind";

/** Resolve relative upload paths against the API origin for Image / preview. */
export function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("file:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function isLikelyImageUrl(url: string): boolean {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.startsWith("data:image/")) return true;
  if (detectFileKind(url) === "image") return true;
  // Gallery picks often lack an extension on the local URI.
  if (path.startsWith("file:") || path.startsWith("content:") || path.startsWith("ph://")) {
    const name = path.split("/").pop() || "";
    if (!name.includes(".")) return true;
  }
  return false;
}

export function isLikelyAudioUrl(url: string): boolean {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.startsWith("data:audio/")) return true;
  return detectFileKind(url) === "audio";
}

export function fileNameFromUrl(url: string): string {
  try {
    const path = url.split("?")[0] ?? url;
    return decodeURIComponent(path.split("/").pop() || "file");
  } catch {
    return "file";
  }
}
