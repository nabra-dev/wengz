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
  return (
    /\.(jpe?g|png|gif|webp|heic|heif)$/.test(path) ||
    path.includes("/uploads/") ||
    path.includes("/api/files/")
  );
}
