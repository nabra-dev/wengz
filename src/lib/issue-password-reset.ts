import type { PrismaClient } from "@prisma/client";
import { sendPasswordResetEmail } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/password-reset";

export type IssuePasswordResetResult = "sent" | "email_failed" | "error";

/**
 * Create a reset token and email the link. On SMTP / URL failure, revoke unused tokens.
 */
export async function issuePasswordResetEmail(params: {
  db: PrismaClient;
  user: { id: string; email: string; name: string | null };
  locale: string;
}): Promise<IssuePasswordResetResult> {
  const { db, user, locale } = params;
  try {
    const { rawToken } = await createPasswordResetToken(db, user.id);
    const resetUrl = buildPasswordResetUrl(locale, rawToken);
    const emailSent = await sendPasswordResetEmail({
      userEmail: user.email,
      userName: user.name || "User",
      resetUrl,
      expiresInMinutes: Math.round(PASSWORD_RESET_TTL_MS / 60_000),
      locale,
    });

    if (!emailSent) {
      await db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      logger.error("Password reset email was not sent (SMTP skipped or failed)", {
        userId: user.id,
        email: user.email,
      });
      return "email_failed";
    }

    return "sent";
  } catch (error) {
    logger.error("Failed to issue password reset email:", error);
    try {
      await db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
    } catch {
      // best-effort revoke
    }
    return "error";
  }
}
