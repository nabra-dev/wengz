import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_PORT = "3001";

function stripSlash(url: string) {
  return url.replace(/\/$/, "");
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

function isLoopbackUrl(url: string) {
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Host that Metro / Expo Go is serving from (LAN IP on a physical phone). */
function bundlerHost(): string | null {
  const extras = Constants.expoConfig?.extra as { debuggerHost?: string } | undefined;
  const candidates = [
    Constants.expoConfig?.hostUri,
    extras?.debuggerHost,
    // Expo Go / legacy manifests
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2
      ?.extra?.expoClient?.hostUri,
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost,
    Constants.linkingUri,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  for (const raw of candidates) {
    const cleaned = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split("/")[0] ?? "";
    const host = cleaned.split(":")[0]?.trim();
    if (host && !isLoopbackHost(host) && host !== "exp.host") return host;
  }
  return null;
}

function configuredApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  return stripSlash(fromEnv || fromExtra || `http://localhost:${DEFAULT_PORT}`);
}

/**
 * Backend origin (Next.js).
 * On a physical device, loopback (`localhost` / `127.0.0.1`) is rewritten to the
 * same LAN host Expo is using so the phone can reach your Mac.
 */
function resolveApiUrl(): string {
  const configured = configuredApiUrl();

  // Simulators / web on the same machine can use loopback as-is.
  if (Platform.OS === "web") return configured;
  if (!__DEV__ || !isLoopbackUrl(configured)) return configured;

  const host = bundlerHost();
  if (!host) return configured;

  try {
    const u = new URL(configured);
    u.hostname = host;
    if (!u.port) u.port = DEFAULT_PORT;
    return stripSlash(u.toString());
  } catch {
    return `http://${host}:${DEFAULT_PORT}`;
  }
}

export const API_URL = resolveApiUrl();
export const REST_BASE = `${API_URL}/api/rest`;
export const UPLOAD_URL = `${API_URL}/api/upload`;
