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

/** Look up a still-valid unused token without consuming it. */
export async function findValidPasswordResetToken(
  db: PrismaClient,
  rawToken: string
): Promise<{ id: string; userId: string } | null> {
  const tokenHash = hashPasswordResetToken(rawToken);
  const now = new Date();
  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.usedAt || row.expiresAt <= now) return null;
  return { id: row.id, userId: row.userId };
}

/**
 * Atomically consume the reset token, set the new password hash, bump
 * passwordChangedAt, clear DB sessions, and invalidate sibling tokens.
 */
export async function finalizePasswordReset(
  db: PrismaClient,
  tokenId: string,
  userId: string,
  hashedPassword: string
): Promise<boolean> {
  const now = new Date();
  const passwordChangedAt = now;

  return db.$transaction(async (tx) => {
    const used = await tx.passwordResetToken.updateMany({
      where: { id: tokenId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (used.count === 0) return false;

    await tx.passwordResetToken.updateMany({
      where: { userId, usedAt: null, id: { not: tokenId } },
      data: { usedAt: now },
    });

    await tx.user.update({
      where: { id: userId },
      data: { password: hashedPassword, passwordChangedAt },
    });

    await tx.session.deleteMany({ where: { userId } });
    return true;
  });
}

export function getPasswordResetBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

export function buildPasswordResetUrl(locale: string, rawToken: string): string {
  const base = getPasswordResetBaseUrl();
  if (!base) {
    throw new Error(
      "NEXTAUTH_URL or NEXT_PUBLIC_APP_URL must be set to build password reset links"
    );
  }
  return `${base}/${locale}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Persist a new password hash, bump passwordChangedAt, and clear DB sessions.
 * Callers must also invalidate session-user cache for this user.
 */
export async function persistPasswordChange(
  db: PrismaClient,
  userId: string,
  hashedPassword: string
): Promise<Date> {
  const passwordChangedAt = new Date();
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { password: hashedPassword, passwordChangedAt },
    }),
    db.session.deleteMany({ where: { userId } }),
  ]);
  return passwordChangedAt;
}
