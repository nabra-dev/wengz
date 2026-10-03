/**
 * Resolve NextAuth cookie session OR mobile Bearer token for App Router routes.
 */
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import type { Session } from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  extractBearerToken,
  resolveRequestLocale,
  sessionFromBearerToken,
} from "@/lib/mobile-auth";

export async function getRequestSession(
  req?: NextRequest | Request
): Promise<{ session: Session | null; locale: "en" | "ar" }> {
  const headers = req?.headers;
  const cookieHeader =
    headers instanceof Headers ? (headers.get("cookie") ?? undefined) : undefined;
  const locale = resolveRequestLocale(headers, cookieHeader);

  const bearer = extractBearerToken(headers);
  if (bearer) {
    const session = await sessionFromBearerToken(bearer);
    return { session, locale };
  }

  if (req && "cookies" in req) {
    const token = await getToken({
      req: req as NextRequest,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (token?.id && token.role && !token.error) {
      const session: Session = {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        user: {
          id: String(token.id),
          email: String(token.email ?? ""),
          name: String(token.name ?? ""),
          role: token.role as Session["user"]["role"],
          image: (token.picture as string | null) || "/images/logo.svg",
          phone: (token.phone as string | null) ?? null,
          passwordChangedAt:
            typeof token.passwordChangedAt === "number" ? token.passwordChangedAt : 0,
        },
      };
      return { session, locale };
    }
  }

  const session = await getServerSession(authOptions);
  return { session, locale };
}
