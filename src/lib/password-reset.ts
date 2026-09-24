import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashPasswordResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generatePasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Invalidate prior unused tokens and create a new one.
 * Returns the raw token to email (never store raw).
 */
export async function createPasswordResetToken(
  db: PrismaClient,
  userId: string
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await db.$transaction([
    db.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    }),
  ]);

  return { rawToken, expiresAt };
}

export async function consumePasswordResetToken(
  db: PrismaClient,
  rawToken: string
): Promise<{ userId: string } | null> {
  const tokenHash = hashPasswordResetToken(rawToken);
  const now = new Date();

  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!row || row.usedAt || row.expiresAt <= now) {
    return null;
  }

  const used = await db.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  if (used.count === 0) return null;

  // Invalidate any other outstanding tokens for this user
  await db.passwordResetToken.updateMany({
    where: { userId: row.userId, usedAt: null, id: { not: row.id } },
    data: { usedAt: now },
  });

  return { userId: row.userId };
}

export function buildPasswordResetUrl(locale: string, rawToken: string): string {
  const base = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(
    /\/$/,
    ""
  );
  return `${base}/${locale}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
}
