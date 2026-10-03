/**
 * Bearer tokens for native (Expo) clients.
 * Tokens are NextAuth-compatible JWTs signed with NEXTAUTH_SECRET.
 */
import { encode, decode, type JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isStaffRole, type AppRole } from "@/lib/roles";
import { normalizeAppLocale } from "@/lib/notifications/i18n-helper";

const DEFAULT_AVATAR = "/images/logo.svg";
const DUMMY_PASSWORD_HASH = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
const MOBILE_TOKEN_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days
const MOBILE_TOKEN_TYP = "mobile";

export type MobileAuthUser = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  image: string | null;
  phone: string | null;
  passwordChangedAt: number;
};

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured");
  }
  return secret;
}

export function extractBearerToken(
  headers: Headers | Record<string, string | string[] | undefined> | undefined
): string | null {
  if (!headers) return null;
  let value: string | null = null;
  if (headers instanceof Headers) {
    value = headers.get("authorization") ?? headers.get("Authorization");
  } else {
    const raw = headers.authorization ?? headers.Authorization;
    value = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  }
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

export function resolveRequestLocale(
  headers: Headers | Record<string, string | string[] | undefined> | undefined,
  cookieHeader?: string
): "en" | "ar" {
  const read = (name: string): string | undefined => {
    if (!headers) return undefined;
    if (headers instanceof Headers) {
      return headers.get(name) ?? undefined;
    }
    const raw = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const xLocale = read("x-locale") ?? read("X-Locale");
  if (xLocale) return normalizeAppLocale(xLocale);

  const accept = read("accept-language") ?? read("Accept-Language");
  if (accept?.toLowerCase().startsWith("ar")) return "ar";

  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)NEXT_LOCALE=(en|ar)/i);
    if (match?.[1]) return normalizeAppLocale(match[1]);
  }

  return "en";
}

export async function issueMobileAccessToken(user: MobileAuthUser): Promise<{
  accessToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}> {
  const accessToken = await encode({
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      picture: user.image || DEFAULT_AVATAR,
      phone: user.phone,
      passwordChangedAt: user.passwordChangedAt,
      typ: MOBILE_TOKEN_TYP,
    } as JWT,
    secret: getSecret(),
    maxAge: MOBILE_TOKEN_MAX_AGE_SEC,
  });

  return {
    accessToken,
    expiresIn: MOBILE_TOKEN_MAX_AGE_SEC,
    tokenType: "Bearer",
  };
}

export async function sessionFromBearerToken(rawToken: string): Promise<Session | null> {
  let token: JWT | null = null;
  try {
    token = await decode({
      token: rawToken,
      secret: getSecret(),
    });
  } catch {
    return null;
  }

  if (!token?.id || typeof token.id !== "string" || !token.role) {
    return null;
  }
  if (token.error) return null;

  const dbUser = await db.user.findUnique({
    where: { id: token.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      image: true,
      phone: true,
      passwordChangedAt: true,
      deletedAt: true,
      approvalStatus: true,
    },
  });

  if (!dbUser || dbUser.deletedAt || dbUser.approvalStatus !== "APPROVED") {
    return null;
  }

  const changedAt = dbUser.passwordChangedAt?.getTime() ?? 0;
  const tokenChangedAt = typeof token.passwordChangedAt === "number" ? token.passwordChangedAt : 0;
  if (changedAt > tokenChangedAt) {
    return null;
  }

  const expires = new Date(Date.now() + MOBILE_TOKEN_MAX_AGE_SEC * 1000).toISOString();

  return {
    expires,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name || "",
      role: dbUser.role,
      image: dbUser.image || DEFAULT_AVATAR,
      phone: dbUser.phone,
      passwordChangedAt: changedAt,
    },
  };
}

export type MobileLoginResult =
  | { ok: true; user: MobileAuthUser; accessToken: string; expiresIn: number; tokenType: "Bearer" }
  | { ok: false; code: string; message: string };

/**
 * Credential login for the CLIENT mobile app.
 * Non-clients are rejected (client-only app).
 */
export async function mobileClientLogin(params: {
  email: string;
  password: string;
  ip?: string;
}): Promise<MobileLoginResult> {
  const email = params.email.toLowerCase().trim();
  const ip = params.ip || "unknown";

  const rl = rateLimit(`mobile-login:${email}:${ip}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many login attempts. Please try again shortly.",
    };
  }

  const user = await db.user.findFirst({
    where: { email, deletedAt: null },
  });

  const passwordHash = user?.password || DUMMY_PASSWORD_HASH;
  const isPasswordValid = await bcrypt.compare(params.password, passwordHash);

  if (!user?.password || !isPasswordValid) {
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid email or password" };
  }

  if (user.approvalStatus === "PENDING") {
    return {
      ok: false,
      code: "ACCOUNT_PENDING_APPROVAL",
      message: "Your account is pending approval",
    };
  }
  if (user.approvalStatus === "REJECTED") {
    const reason = user.rejectionReason?.trim() || "";
    return {
      ok: false,
      code: "ACCOUNT_REJECTED",
      message: reason || "Your account was not approved",
    };
  }

  if (user.role !== "CLIENT") {
    return {
      ok: false,
      code: "CLIENT_ONLY",
      message: "This app is for clients only. Please use the web dashboard.",
    };
  }

  const maintenanceSetting = await db.systemSettings.findUnique({
    where: { key: "maintenance_mode" },
    select: { value: true },
  });
  const maintenanceEnabled = Boolean(
    (maintenanceSetting?.value as { enabled?: boolean } | null | undefined)?.enabled
  );
  if (maintenanceEnabled && !isStaffRole(user.role)) {
    return {
      ok: false,
      code: "MAINTENANCE_MODE",
      message: "Login is temporarily unavailable during maintenance",
    };
  }

  const authUser: MobileAuthUser = {
    id: user.id,
    email: user.email,
    name: user.name || "",
    role: user.role,
    image: user.image || DEFAULT_AVATAR,
    phone: user.phone,
    passwordChangedAt: user.passwordChangedAt?.getTime() ?? 0,
  };

  const issued = await issueMobileAccessToken(authUser);
  return { ok: true, user: authUser, ...issued };
}
