import createMiddleware from "next-intl/middleware";
import { withAuth } from "next-auth/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

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

function handlePublicRouting(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const firstSegment = pathname.split("/").find(Boolean);

  if (pathname === "/favicon.ico") {
    return NextResponse.rewrite(new URL("/images/logo.png", req.url));
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
    const url = req.nextUrl.clone();
    url.pathname = normalizedPath || "/";
    return NextResponse.redirect(url, 308);
  }

  const hasLocale = routing.locales.includes(firstSegment as (typeof routing.locales)[number]);

  if (!hasLocale) {
    const cookieLocale = req.cookies.get("NEXT_LOCALE")?.value;
    const preferredLocale = routing.locales.includes(
      cookieLocale as (typeof routing.locales)[number]
    )
      ? (cookieLocale as (typeof routing.locales)[number])
      : routing.defaultLocale;

    const url = req.nextUrl.clone();
    url.pathname = `/${preferredLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  return handleI18nRouting(req);
}

const authMiddleware = withAuth(
  function middleware(req) {
    const intlResponse = handleI18nRouting(req);
    const token = req.nextauth.token;
    const basePath = getPathWithoutLocale(req.nextUrl.pathname);

    if (basePath.startsWith("admin") && token?.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (
      basePath.startsWith("provider") &&
      token?.role !== "PROVIDER" &&
      token?.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (
      basePath.startsWith("client") &&
      token?.role !== "CLIENT" &&
      token?.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return intlResponse;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export default function middleware(req: NextRequest) {
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
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
