import { NextResponse, type NextRequest } from "next/server";
import { routing, type AppLocale } from "@/i18n/routing";
import { LOCALE_SWITCH_CACHE_BUST } from "@/lib/locale-switch";

function isAppLocale(value: string | null): value is AppLocale {
  return !!value && (routing.locales as readonly string[]).includes(value);
}

/**
 * Atomically set NEXT_LOCALE and redirect. Used by the language switcher so the
 * preference is applied even when client onClick handlers fail to run.
 */
export function GET(req: NextRequest) {
  const localeParam = req.nextUrl.searchParams.get("set");
  const nextParam = req.nextUrl.searchParams.get("next") || "/";

  if (!isAppLocale(localeParam)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Only allow same-origin relative paths (block open redirects).
  const nextPath = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  let destination = nextPath;
  if (localeParam === routing.defaultLocale) {
    const join = nextPath.includes("?") ? "&" : "?";
    destination = `${nextPath}${join}${LOCALE_SWITCH_CACHE_BUST}=${localeParam}`;
  } else if (!nextPath.startsWith(`/${localeParam}`)) {
    destination = nextPath === "/" ? `/${localeParam}` : `/${localeParam}${nextPath}`;
  }

  const response = NextResponse.redirect(new URL(destination, req.url), 307);
  response.cookies.set("NEXT_LOCALE", localeParam, { path: "/", sameSite: "lax" });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
