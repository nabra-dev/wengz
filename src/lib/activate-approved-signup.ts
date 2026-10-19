import type { PrismaClient, Role } from "@prisma/client";
import { assignFreeClientSubscription } from "@/lib/free-client-subscription";
import {
  notifyAdminsNewUserRegistration,
  sendAccountApprovedEmail,
  sendApplicationReceivedEmail,
  sendWelcomeEmail,
} from "@/lib/notifications";
import { logger } from "@/lib/logger";

type SignupUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};

function asClientOrProvider(role: Role): "CLIENT" | "PROVIDER" {
  return role === "PROVIDER" ? "PROVIDER" : "CLIENT";
}

/**
 * Side effects after self-serve signup / re-apply.
 * Pending → application-received mail + staff notify.
 * Auto-approved → free trial (clients), welcome + approved mail + staff notify.
 */
export async function runSignupSideEffects(params: {
  db: PrismaClient;
  user: SignupUser;
  requiresPendingApproval: boolean;
  locale: string;
  reapplied?: boolean;
}): Promise<void> {
  const { db, user, requiresPendingApproval, locale, reapplied } = params;
  const userName = user.name || "User";
  const signupRole = asClientOrProvider(user.role);

  if (requiresPendingApproval) {
    sendApplicationReceivedEmail({
      userEmail: user.email,
      userName,
      userRole: signupRole,
      locale,
    }).catch((error) => {
      logger.error("Failed to send application received email:", error);
    });

    void notifyAdminsNewUserRegistration({
      userName,
      userEmail: user.email,
      userRole: signupRole,
      userId: user.id,
      reapplied: Boolean(reapplied),
    }).catch((error) => {
      logger.error("Failed to notify admins of registration:", error);
    });
    return;
  }

  if (signupRole === "CLIENT") {
    await assignFreeClientSubscription(db, user.id);
  }

  sendWelcomeEmail({
    userId: user.id,
    userName,
    userEmail: user.email,
    userRole: signupRole,
    locale,
    email: false,
  }).catch(() => undefined);

  sendAccountApprovedEmail({
    userEmail: user.email,
    userName,
    locale,
  }).catch(() => undefined);

  void notifyAdminsNewUserRegistration({
    userName,
    userEmail: user.email,
    userRole: signupRole,
    userId: user.id,
    reapplied: Boolean(reapplied),
  }).catch((error) => {
    logger.error("Failed to notify admins of auto-approved registration:", error);
  });
}

export function signupSuccessMessage(requiresPendingApproval: boolean, reapplied: boolean): string {
  if (requiresPendingApproval) {
    return reapplied
      ? "Application re-submitted. An admin will review it shortly."
      : "Application submitted. An admin will review it shortly.";
  }
  return reapplied
    ? "Application accepted. You can sign in now."
    : "Account created. You can sign in now.";
}
