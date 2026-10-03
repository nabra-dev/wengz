import createMiddleware from "next-intl/middleware";
import { withAuth } from "next-auth/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { canAccessAdminPath, getStaffHomePath, isStaffRole } from "./lib/roles";
import { CANONICAL_HOST } from "./lib/seo";
import { publicRedirectUrl } from "./lib/request-origin";

const handleI18nRouting = createMiddleware(routing);

/**
 * Locale preference redirects must never be cached (308 + public Cache-Control on `/`
 * previously trapped AR→EN switches: `/en` → `/` → cached `/ar`).
 */
function localeRedirect(url: URL, locale: (typeof routing.locales)[number]): NextResponse {
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set("NEXT_LOCALE", locale, { path: "/", sameSite: "lax" });
  return response;
}

/** WordPress / CMS scanners and similar probes — return 404 without rendering pages. */
function isProbeNoise(pathname: string): boolean {
  const path = pathname.toLowerCase();
  if (
    path.includes("/wp-admin") ||
    path.includes("/wp-login") ||
    path.includes("/wp-content") ||
    path.includes("/wp-includes") ||
    path.includes("/xmlrpc") ||
    path.includes("/wordpress") ||
    path.includes("/.env") ||
    path.includes("/phpmyadmin")
  ) {
    return true;
  }
  return /\.(php|asp|aspx|jsp|cgi)$/i.test(path);
}

function getPathWithoutLocale(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];
  const rest = routing.locales.includes(maybeLocale as (typeof routing.locales)[number])
    ? segments.slice(1)
    : segments;
  return rest.join("/");
}

function isProtected(pathname: string) {
  const first = getPathWithoutLocale(pathname).split("/")[0];
  return first === "client" || first === "provider" || first === "admin";
}

/** Apex is canonical — www must 301 so Google does not treat two hosts as duplicates. */
function redirectWwwToApex(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (host !== `www.${CANONICAL_HOST}`) return null;

  const url = publicRedirectUrl(req, `${req.nextUrl.pathname}${req.nextUrl.search}`);
  url.protocol = "https:";
  url.host = CANONICAL_HOST;
  url.port = "";
  return NextResponse.redirect(url, 301);
}

function handlePublicRouting(req: NextRequest) {
  const wwwRedirect = redirectWwwToApex(req);
  if (wwwRedirect) return wwwRedirect;

  const pathname = req.nextUrl.pathname;
  if (isProbeNoise(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const firstSegment = pathname.split("/").find(Boolean);

  if (pathname === "/favicon.ico") {
    return NextResponse.rewrite(publicRedirectUrl(req, "/images/logo.png"));
  }

  const isApi = pathname.startsWith("/api");
  const isNext = pathname.startsWith("/_next");
  const isKnownFile =
    pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/manifest.json";
  const hasFileExtension = pathname.includes(".");
  if (isApi || isNext || isKnownFile || hasFileExtension) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  const isDoubleLocale =
    segments.length >= 2 &&
    routing.locales.includes(segments[0] as (typeof routing.locales)[number]) &&
    routing.locales.includes(segments[1] as (typeof routing.locales)[number]);

  if (isDoubleLocale) {
    const normalizedPath = `/${segments[0]}${segments.slice(2).length ? `/${segments.slice(2).join("/")}` : ""}`;
    // 307: URL shape can change with user preference; never cache permanently.
    return localeRedirect(
      publicRedirectUrl(req, normalizedPath || "/"),
      segments[0] as (typeof routing.locales)[number]
    );
  }

  const hasLocale = routing.locales.includes(firstSegment as (typeof routing.locales)[number]);

  if (!hasLocale) {
    const cookieLocale = req.cookies.get("NEXT_LOCALE")?.value;
    const preferredLocale = routing.locales.includes(
      cookieLocale as (typeof routing.locales)[number]
    )
      ? (cookieLocale as (typeof routing.locales)[number])
      : routing.defaultLocale;

    const localizedPath = `/${preferredLocale}${pathname === "/" ? "" : pathname}`;

    // Non-default locale must be a real URL so canonical and request path match for crawlers.
    // Must be temporary + uncacheable: a cached 308 `/` → `/ar` traps language switches to EN.
    if (preferredLocale !== routing.defaultLocale) {
      return localeRedirect(publicRedirectUrl(req, localizedPath), preferredLocale);
    }

    const url = req.nextUrl.clone();
    url.pathname = localizedPath;
    const rewrite = NextResponse.rewrite(url);
    rewrite.cookies.set("NEXT_LOCALE", preferredLocale, { path: "/", sameSite: "lax" });
    return rewrite;
  }

  return handleI18nRouting(req);
}

const authMiddleware = withAuth(
  function middleware(req) {
    const wwwRedirect = redirectWwwToApex(req);
    if (wwwRedirect) return wwwRedirect;

    const intlResponse = handleI18nRouting(req);
    const token = req.nextauth.token;
    const basePath = getPathWithoutLocale(req.nextUrl.pathname);

    if (basePath.startsWith("admin")) {
      const role = token?.role as string | undefined;
      if (!isStaffRole(role)) {
        return NextResponse.redirect(publicRedirectUrl(req, "/"));
      }
      if (!canAccessAdminPath(role, basePath)) {
        return NextResponse.redirect(publicRedirectUrl(req, getStaffHomePath(role)));
      }
    }

    if (
      basePath.startsWith("provider") &&
      token?.role !== "PROVIDER" &&
      token?.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.redirect(publicRedirectUrl(req, "/"));
    }

    if (
      basePath.startsWith("client") &&
      token?.role !== "CLIENT" &&
      token?.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.redirect(publicRedirectUrl(req, "/"));
    }

    return intlResponse;
  },
  {
    callbacks: {
      // Reject cleared / password-rotated JWTs (token may still exist with `error` only).
      authorized: ({ token }) => Boolean(token?.id) && !token?.error,
    },
  }
);

export default function middleware(req: NextRequest) {
  if (isProbeNoise(req.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  // Skip NextAuth JWT work on public marketing/auth routes
  if (!isProtected(req.nextUrl.pathname)) {
    return handlePublicRouting(req);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authMiddleware as any)(req);
}

export const config = {
  matcher: [
    /*
     * Match app routes, plus robots/sitemap/manifest so www→apex applies to crawl files.
     * Other dotted static assets stay on nginx (or Next static) without this middleware.
     * Exclude sentry-tunnel so the Sentry same-origin proxy is not rewritten/blocked.
     */
    "/((?!api|sentry-tunnel|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.json",
    // Probe paths with extensions (normally excluded by .*\\..*) — short-circuit to 404
    "/:path*.php",
    "/:path*.asp",
    "/:path*.aspx",
    "/:path*.jsp",
    "/:path*.cgi",
  ],
};
