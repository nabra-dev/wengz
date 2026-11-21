import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getAccessToken } from "./auth-store";
import { fileNameFromUrl, resolveMediaUrl } from "./media";

const memoryCache = new Map<string, string>();

function isLocalUri(url: string): boolean {
  return (
    url.startsWith("file:") ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("content:") ||
    url.startsWith("ph://")
  );
}

function safeCacheName(remoteUrl: string): string {
  const raw = fileNameFromUrl(remoteUrl).replace(/[^a-zA-Z0-9._-]/g, "_");
  return raw || `file-${Date.now()}`;
}

/**
 * Download an auth-protected `/api/files/...` URL into the app cache and return
 * a local `file://` URI. Local/preview URIs pass through.
 */
export async function cacheAuthedFile(remoteUrl: string): Promise<string> {
  if (!remoteUrl) throw new Error("Missing file URL");
  if (isLocalUri(remoteUrl)) return remoteUrl;

  const hit = memoryCache.get(remoteUrl);
  if (hit) {
    const info = await FileSystem.getInfoAsync(hit);
    if (info.exists) return hit;
    memoryCache.delete(remoteUrl);
  }

  const base = FileSystem.cacheDirectory;
  if (!base) throw new Error("No cache directory");

  const dir = `${base}wengz-media/`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // already exists
  }

  const token = await getAccessToken();
  const dest = `${dir}${Date.now()}-${safeCacheName(remoteUrl)}`;
  const result = await FileSystem.downloadAsync(resolveMediaUrl(remoteUrl), dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`File download failed (${result.status})`);
  }

  memoryCache.set(remoteUrl, result.uri);
  return result.uri;
}

/** Share / save a remote attachment (download icon). */
export async function shareAuthedFile(remoteUrl: string): Promise<void> {
  const local = await cacheAuthedFile(remoteUrl);
  const name = fileNameFromUrl(remoteUrl);

  if (Platform.OS === "web") {
    await Share.share({ url: resolveMediaUrl(remoteUrl), title: name, message: name });
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(local, {
      dialogTitle: name,
      mimeType: undefined,
      UTI: undefined,
    });
    return;
  }

  // Fallback — system share sheet with file URL
  let uri = local;
  if (Platform.OS === "android") {
    try {
      uri = await FileSystem.getContentUriAsync(local);
    } catch {
      /* keep file:// */
    }
  }
  await Share.share({ url: uri, title: name, message: name });
}
