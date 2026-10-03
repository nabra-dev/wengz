import { API_URL } from "./config";

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
  if (/\.(jpe?g|png|gif|webp|heic|heif)$/.test(path)) return true;
  // Gallery picks often lack an extension on the local URI.
  if (path.startsWith("file:") || path.startsWith("content:") || path.startsWith("ph://")) {
    const name = path.split("/").pop() || "";
    if (!name.includes(".")) return true;
  }
  return false;
}

export function fileNameFromUrl(url: string): string {
  try {
    const path = url.split("?")[0] ?? url;
    return decodeURIComponent(path.split("/").pop() || "file");
  } catch {
    return "file";
  }
}
