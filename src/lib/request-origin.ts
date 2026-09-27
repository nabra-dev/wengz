/**
 * Resolve the public browser origin for redirects.
 *
 * Behind Docker/nginx/Caddy, `req.url` is often `http://localhost:3001/...`.
 * Using that for `NextResponse.redirect` sends users to localhost in production.
 * Prefer forwarded host headers, then Host, then configured public env URLs.
 */

const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i;

function firstHeaderValue(
  headers: Headers | { get(name: string): string | null | undefined },
  name: string
): string | null {
  const raw = headers.get(name);
  if (!raw) return null;
  return raw.split(",")[0]?.trim() || null;
}

function isLoopbackHost(host: string): boolean {
  const hostname = host.split(":")[0] || host;
  return LOOPBACK_HOST.test(host) || LOOPBACK_HOST.test(hostname);
}

function originFromConfiguredEnv(): string | null {
  for (const raw of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXTAUTH_URL]) {
    if (!raw?.startsWith("http")) continue;
    try {
      const url = new URL(raw);
      if (!isLoopbackHost(url.host)) return url.origin;
    } catch {
      // ignore invalid env
    }
  }
  return null;
}

export type RequestLike = {
  headers: Headers | { get(name: string): string | null | undefined };
  url: string;
};

/**
 * Public origin as the browser sees it (never prefer internal localhost in prod).
 */
export function resolvePublicRequestOrigin(req: RequestLike): string {
  const forwardedHost = firstHeaderValue(req.headers, "x-forwarded-host");
  const hostHeader = firstHeaderValue(req.headers, "host");
  const forwardedProto = firstHeaderValue(req.headers, "x-forwarded-proto");
  const configured = originFromConfiguredEnv();

  if (forwardedHost && !isLoopbackHost(forwardedHost)) {
    const proto = (forwardedProto || "https").replace(/:$/, "");
    return `${proto}://${forwardedHost}`;
  }

  if (hostHeader && !isLoopbackHost(hostHeader)) {
    const proto = (forwardedProto || "https").replace(/:$/, "");
    return `${proto}://${hostHeader}`;
  }

  // Proxy forgot forwarded headers — still must not emit localhost Location in prod.
  if (configured) return configured;

  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3001";
  }
}

/** Build an absolute same-site redirect URL from a relative path. */
export function publicRedirectUrl(req: RequestLike, path: string): URL {
  const origin = resolvePublicRequestOrigin(req);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${origin}/`);
}
