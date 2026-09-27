import { NextResponse, type NextRequest } from "next/server";
import { routing, type AppLocale } from "@/i18n/routing";
import { buildLocaleDestinationPath } from "@/lib/locale-switch";
import { publicRedirectUrl } from "@/lib/request-origin";

function isAppLocale(value: string | null): value is AppLocale {
  return !!value && (routing.locales as readonly string[]).includes(value);
}

function parseLocaleSwitchInput(req: NextRequest, body?: { set?: string; next?: string }) {
  const localeParam = body?.set ?? req.nextUrl.searchParams.get("set");
  const nextParam = body?.next ?? req.nextUrl.searchParams.get("next") ?? "/";
  if (!isAppLocale(localeParam)) return null;

  // Only allow same-origin relative paths (block open redirects).
  const nextPath = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const destination = buildLocaleDestinationPath(localeParam, nextPath);
  return { locale: localeParam, destination };
}

function applyLocaleCookie(response: NextResponse, locale: AppLocale) {
  response.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    sameSite: "lax",
    // Secure in production so the preference sticks on HTTPS only.
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("Cache-Control", "private, no-store");
}

/**
 * JSON locale switch — preferred by the client switcher.
 * Sets NEXT_LOCALE and returns the destination path (no Location redirect),
 * so production never depends on req.url / localhost origins.
 */
export async function POST(req: NextRequest) {
  let body: { set?: string; next?: string } = {};
  try {
    body = (await req.json()) as { set?: string; next?: string };
  } catch {
    body = {};
  }

  const parsed = parseLocaleSwitchInput(req, body);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "Invalid locale" }, { status: 400 });
  }

  const response = NextResponse.json({
    ok: true,
    locale: parsed.locale,
    destination: parsed.destination,
  });
  applyLocaleCookie(response, parsed.locale);
  return response;
}

/**
 * GET fallback for progressive enhancement / no-JS.
 * Redirect must use the public origin (x-forwarded-* / APP_URL), never internal localhost.
 */
export function GET(req: NextRequest) {
  const parsed = parseLocaleSwitchInput(req);
  if (!parsed) {
    return NextResponse.redirect(publicRedirectUrl(req, "/"), 307);
  }

  const response = NextResponse.redirect(publicRedirectUrl(req, parsed.destination), 307);
  applyLocaleCookie(response, parsed.locale);
  return response;
}
