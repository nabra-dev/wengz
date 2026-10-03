import type { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";

/**
 * Allow Expo web (and other local clients) to call REST / upload from another origin.
 * Production: only same-origin or explicitly listed MOBILE_CORS_ORIGINS.
 */
export function isAllowedCorsOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  if (process.env.NODE_ENV === "development") {
    return (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:") ||
      origin.startsWith("http://192.168.") ||
      origin.startsWith("http://10.")
    );
  }
  const allowed = (process.env.MOBILE_CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

export function applyPagesCors(req: NextApiRequest, res: NextApiResponse): boolean {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : null;
  if (!isAllowedCorsOrigin(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin!);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Locale, Accept-Language"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  return true;
}

export function withPagesCors(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown | Promise<unknown>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    applyPagesCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    return handler(req, res);
  };
}

/** App Router: merge CORS onto a NextResponse (or build a 204 for OPTIONS). */
export function appCorsHeaders(req: Request): HeadersInit | null {
  const origin = req.headers.get("origin");
  if (!isAllowedCorsOrigin(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin!,
    Vary: "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Locale, Accept-Language",
    "Access-Control-Max-Age": "86400",
  };
}

export function appCorsOptionsResponse(req: Request): NextResponse | null {
  const headers = appCorsHeaders(req);
  if (!headers) return null;
  return new NextResponse(null, { status: 204, headers });
}

export function withAppCors(req: Request, res: NextResponse): NextResponse {
  const headers = appCorsHeaders(req);
  if (!headers) return res;
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  return res;
}
