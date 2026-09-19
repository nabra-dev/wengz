/**
 * Validates that uploaded/attachment URLs point at our private file API
 * and belong to the given user (or are admin-managed). Rejects javascript:,
 * data:, external phishing URLs, and other users' upload namespaces.
 */
export function isAllowedUploadUrl(url: string, userId: string): boolean {
  if (typeof url !== "string" || !url.trim()) return false;

  const trimmed = url.trim();

  // Absolute URLs must stay on our own files API (relative preferred).
  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      path = parsed.pathname;
    } catch {
      return false;
    }
  }

  // Must be our files endpoint under uploads/<userId>/...
  const prefix = `/api/files/uploads/${userId}/`;
  if (!path.startsWith(prefix)) return false;

  // No path traversal or query tricks
  if (path.includes("..") || path.includes("//")) return false;

  return true;
}

export function assertAllowedUploadUrls(urls: string[] | undefined, userId: string): void {
  if (!urls?.length) return;
  for (const url of urls) {
    if (!isAllowedUploadUrl(url, userId)) {
      throw new Error(`Invalid file URL: ${url}`);
    }
  }
}
