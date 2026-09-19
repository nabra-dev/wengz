/**
 * Pick message namespaces for public (marketing) vs authenticated shells.
 * Keeps landing/auth payloads smaller by omitting dashboard role dictionaries.
 */

const PUBLIC_NAMESPACES = [
  "common",
  "wengz",
  "landing",
  "forms",
  "notFound",
  "auth",
  "ui",
  "locales",
  "errors",
  "pwa",
  "legal",
] as const;

export function pickPublicMessages(messages: Record<string, unknown>) {
  const picked: Record<string, unknown> = {};
  for (const key of PUBLIC_NAMESPACES) {
    if (key in messages) {
      picked[key] = messages[key];
    }
  }
  return picked;
}
