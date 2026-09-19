import { db } from "@/lib/db";
import {
  sendEmail,
  getNewMessageEmailTemplate,
  getStatusChangeEmailTemplate,
  getAssignmentEmailTemplate,
  getApprovalReminderEmailTemplate,
  getSubscriptionExpiringEmailTemplate,
  getSubscriptionExpiredEmailTemplate,
  getWelcomeEmailTemplate,
} from "./email";
import { sendNotificationToUser } from "./sse-utils";
import { getTranslation } from "./i18n-helper";
import { logger } from "@/lib/logger";

// Store for SSE notification sender (will be set by SSE route when a user connects)
let sseNotificationSender: ((userId: string, notification: any) => void) | null = null;

export function setSseNotificationSender(sender: (userId: string, notification: any) => void) {
  sseNotificationSender = sender;
}

// Function to get the SSE sender - uses centralized sse-utils
function getSseSender(): (userId: string, notification: any) => void {
  // Use registered sender if available, otherwise fall back to sse-utils
  return sseNotificationSender || sendNotificationToUser;
}

interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type?: "message" | "status_change" | "assignment" | "general";
  link?: string;
  sendEmail?: boolean;
  locale?: string;
  emailTemplate?: {
    subject: string;
    html: string;
  };
  sseI18n?: {
    titleKey?: string;
    titleParams?: Record<string, string>;
    messageKey?: string;
    messageParams?: Record<string, string>;
  };
}

function resolveLocalizedPackageName(params: {
  locale: string;
  packageName: string;
  packageNameI18n?: Record<string, string> | null;
}): string {
  const { locale, packageName, packageNameI18n } = params;
  if (!packageNameI18n || typeof packageNameI18n !== "object") {
    return packageName;
  }

  const localizedValue = packageNameI18n[locale];
  if (localizedValue && localizedValue.trim().length > 0) {
    return localizedValue;
  }

  const englishFallback = packageNameI18n.en;
  if (englishFallback && englishFallback.trim().length > 0) {
    return englishFallback;
  }

  const arabicFallback = packageNameI18n.ar;
  if (arabicFallback && arabicFallback.trim().length > 0) {
    return arabicFallback;
  }

  return packageName;
}

async function sendEmailNotification(
  emailTemplate: NotificationData["emailTemplate"],
  userEmail: string | null | undefined
) {
  if (emailTemplate && userEmail) {
    await sendEmail({
      to: userEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });
  }
}

async function sendSseNotification(
  userId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    link: string | undefined;
    data: { notificationId: string };
    timestamp: Date;
    i18n?: {
      titleKey?: string;
      titleParams?: Record<string, string>;
      messageKey?: string;
      messageParams?: Record<string, string>;
    };
  }
) {
  const sender = getSseSender();
  try {
    sender(userId, notification);
  } catch (error) {
    logger.error("Failed to send SSE notification:", error);
  }
}

export async function createNotification(data: NotificationData) {
  const {
    userId,
    title,
    message,
    type = "general",
    link,
    sendEmail: shouldSendEmail = true,
    emailTemplate,
    sseI18n,
  } = data;

  // Create database notification
  const notification = await db.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      link,
      isRead: false,
    },
  });

  // Fetch user email for optional email delivery
  const user = shouldSendEmail
    ? await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
      })
    : null;

  // Persist in-app notification + SSE first (user-visible path).
  // Email is best-effort and must not block API response latency.
  await sendSseNotification(userId, {
    type,
    title,
    message,
    link: link || undefined,
    data: { notificationId: notification.id },
    timestamp: new Date(),
    i18n: sseI18n,
  });

  if (shouldSendEmail) {
    void sendEmailNotification(emailTemplate, user?.email);
  }

  return notification;
}

export async function notifyAdminsNewPendingPayment(params: {
  clientNameOrEmail: string;
  amount: number;
  currency: string;
  locale?: string;
}) {
  const { clientNameOrEmail, amount, currency, locale = "en" } = params;

  const admins = await db.user.findMany({
    where: { role: "SUPER_ADMIN" },
    select: { id: true, email: true },
  });

  const title = await getTranslation(locale, "notifications.paymentVerification.title");
  const message = await getTranslation(locale, "notifications.paymentVerification.message", {
    clientNameOrEmail,
    amount: amount.toFixed(2),
    currency,
  });
  const link = "/admin/payments";

  // Notify each admin (DB + SSE). Email optional.
  await Promise.all(
    admins.map(async (admin) =>
      createNotification({
        userId: admin.id,
        title,
        message,
        type: "general",
        link,
        sendEmail: false,
        locale,
        sseI18n: {
          titleKey: "notifications.paymentVerification.title",
          messageKey: "notifications.paymentVerification.message",
          messageParams: {
            clientNameOrEmail,
            amount: amount.toFixed(2),
            currency,
          },
        },
      })
    )
  );

  return { notifiedAdmins: admins.length };
}

export async function notifyAdminsNewWithdrawal(params: {
  providerNameOrEmail: string;
  amountUsd: number;
  locale?: string;
}) {
  const { providerNameOrEmail, amountUsd, locale = "en" } = params;

  const admins = await db.user.findMany({
    where: { role: "SUPER_ADMIN" },
    select: { id: true },
  });

  const title = await getTranslation(locale, "notifications.withdrawalRequested.title");
  const message = await getTranslation(locale, "notifications.withdrawalRequested.message", {
    providerNameOrEmail,
    amount: amountUsd.toFixed(2),
  });

  await Promise.all(
    admins.map(async (admin) =>
      createNotification({
        userId: admin.id,
        title,
        message,
        type: "general",
        link: "/admin/finance",
        sendEmail: false,
        locale,
        sseI18n: {
          titleKey: "notifications.withdrawalRequested.title",
          messageKey: "notifications.withdrawalRequested.message",
          messageParams: {
            providerNameOrEmail,
            amount: amountUsd.toFixed(2),
          },
        },
      })
    )
  );
}

export async function notifyProviderWithdrawalReviewed(params: {
  providerId: string;
  status: "APPROVED" | "REJECTED";
  amountUsd: number;
  reason: string;
  locale?: string;
}) {
  const { providerId, status, amountUsd, reason, locale = "en" } = params;
  const key = status === "APPROVED" ? "withdrawalApproved" : "withdrawalRejected";

  const title = await getTranslation(locale, `notifications.${key}.title`);
  const message = await getTranslation(locale, `notifications.${key}.message`, {
    amount: amountUsd.toFixed(2),
    reason,
  });

  return createNotification({
    userId: providerId,
    title,
    message,
    type: "general",
    link: "/provider/wallet",
    sendEmail: false,
    locale,
    sseI18n: {
      titleKey: `notifications.${key}.title`,
      messageKey: `notifications.${key}.message`,
      messageParams: {
        amount: amountUsd.toFixed(2),
        reason,
      },
    },
  });
}

function getLinkForNotificationRecipient(
  recipientRole: string | undefined | null,
  requestId: string,
  isAssigned: boolean
): string {
  if (recipientRole === "CLIENT") return `/client/requests/${requestId}`;
  if (recipientRole === "PROVIDER") {
    return isAssigned ? `/provider/requests/${requestId}` : `/provider/available/${requestId}`;
  }
  return `/provider/requests/${requestId}`;
}

function normalizeStatusKey(status: string): string {
  return status.trim().toUpperCase().replaceAll(" ", "_");
}

/** Localized label for a request status enum (e.g. IN_PROGRESS → Arabic string). */
export async function getLocalizedRequestStatusLabel(
  locale: string,
  status: string
): Promise<string> {
  const normalizedStatus = normalizeStatusKey(status);
  const translationKey = `common.requestStatus.${normalizedStatus}`;
  const translatedStatus = await getTranslation(locale, translationKey);

  // getTranslation falls back to returning the key when missing
  if (translatedStatus === translationKey) {
    return status.replaceAll("_", " ");
  }

  return translatedStatus;
}

export async function notifyNewMessage(params: {
  requestId: string;
  senderName: string;
  senderRole?: string;
  recipientId: string;
  messagePreview: string;
  locale?: string;
}) {
  const { requestId, senderName, recipientId, messagePreview, locale = "en" } = params;

  // Batch both queries in parallel to avoid sequential DB calls
  const [request, user] = await Promise.all([
    db.request.findUnique({
      where: { id: requestId },
      select: { title: true, providerId: true },
    }),
    db.user.findUnique({
      where: { id: recipientId },
      select: { role: true },
    }),
  ]);

  if (!request) return;

  const displayName =
    params.senderRole === "CLIENT"
      ? await getTranslation(locale, "common.roles.CLIENT")
      : senderName;
  const title = await getTranslation(locale, "notifications.newMessage.title", {
    senderName: displayName,
  });
  const message = await getTranslation(locale, "notifications.newMessage.message", {
    messagePreview,
  });
  const emailTemplate = await getNewMessageEmailTemplate(
    senderName,
    request.title,
    messagePreview,
    locale
  );
  const isAssigned = request.providerId === recipientId;
  const link = getLinkForNotificationRecipient(user?.role, requestId, isAssigned);

  return createNotification({
    userId: recipientId,
    title,
    message: message,
    type: "message",
    link,
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.newMessage.title",
      titleParams: { senderName: displayName },
      messageKey: "notifications.newMessage.message",
      messageParams: { messagePreview },
    },
  });
}

export async function notifyStatusChange(params: {
  requestId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  locale?: string;
}) {
  const { requestId, userId, oldStatus, newStatus, locale = "en" } = params;

  // Batch both queries in parallel to avoid sequential DB calls
  const [request, user] = await Promise.all([
    db.request.findUnique({
      where: { id: requestId },
      select: { title: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  ]);

  if (!request) return;

  const [oldStatusLabel, newStatusLabel] = await Promise.all([
    getLocalizedRequestStatusLabel(locale, oldStatus),
    getLocalizedRequestStatusLabel(locale, newStatus),
  ]);

  const title = await getTranslation(locale, "notifications.statusChange.title");
  const message = await getTranslation(locale, "notifications.statusChange.message", {
    requestTitle: request.title,
    oldStatus: oldStatusLabel,
    newStatus: newStatusLabel,
  });
  const emailTemplate = await getStatusChangeEmailTemplate(
    request.title,
    oldStatus,
    newStatus,
    locale
  );
  const linkPrefix = user?.role === "CLIENT" ? "/client" : "/provider";

  return createNotification({
    userId,
    title,
    message,
    type: "status_change",
    link: `${linkPrefix}/requests/${requestId}`,
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.statusChange.title",
      messageKey: "notifications.statusChange.message",
      messageParams: {
        requestTitle: request.title,
        oldStatus: oldStatusLabel,
        newStatus: newStatusLabel,
      },
    },
  });
}

export async function notifyProviderAssignment(params: {
  requestId: string;
  providerId: string;
  providerName: string;
  locale?: string;
}) {
  const { requestId, providerId, providerName, locale = "en" } = params;

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { title: true },
  });

  if (!request) return;

  const title = await getTranslation(locale, "notifications.assignment.title");
  const message = await getTranslation(locale, "notifications.assignment.message", {
    requestTitle: request.title,
  });
  const emailTemplate = await getAssignmentEmailTemplate(request.title, providerName, locale);

  return createNotification({
    userId: providerId,
    title,
    message,
    type: "assignment",
    link: `/provider/my-requests`,
    locale,
    emailTemplate,
  });
}

export async function notifyApprovalReminder(params: {
  requestId: string;
  clientId: string;
  locale?: string;
}) {
  const { requestId, clientId, locale = "en" } = params;

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { title: true },
  });

  if (!request) return;

  const title = await getTranslation(locale, "notifications.approvalReminder.title");
  const message = await getTranslation(locale, "notifications.approvalReminder.message", {
    requestTitle: request.title,
  });
  const emailTemplate = await getApprovalReminderEmailTemplate(request.title, locale);

  return createNotification({
    userId: clientId,
    title,
    message,
    type: "status_change",
    link: `/client/requests/${requestId}`,
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.approvalReminder.title",
      messageKey: "notifications.approvalReminder.message",
      messageParams: { requestTitle: request.title },
    },
  });
}

export async function notifySubscriptionExpiring(params: {
  userId: string;
  packageName: string;
  packageNameI18n?: Record<string, string> | null;
  daysRemaining: number;
  remainingCredits: number;
  locale?: string;
}) {
  const {
    userId,
    packageName,
    packageNameI18n,
    daysRemaining,
    remainingCredits,
    locale = "en",
  } = params;
  const localizedPackageName = resolveLocalizedPackageName({
    locale,
    packageName,
    packageNameI18n,
  });

  const title = await getTranslation(locale, "notifications.subscriptionExpiring.title", {
    packageName: localizedPackageName,
    daysRemaining: daysRemaining.toString(),
  });
  const message = await getTranslation(locale, "notifications.subscriptionExpiring.message", {
    packageName: localizedPackageName,
    daysRemaining: daysRemaining.toString(),
  });
  const emailTemplate = await getSubscriptionExpiringEmailTemplate(
    localizedPackageName,
    daysRemaining,
    remainingCredits,
    locale
  );

  return createNotification({
    userId,
    title,
    message,
    type: "general",
    link: `/client/subscription`,
    locale,
    emailTemplate,
  });
}

export async function notifySubscriptionExpired(params: {
  userId: string;
  packageName: string;
  packageNameI18n?: Record<string, string> | null;
  locale?: string;
}) {
  const { userId, packageName, packageNameI18n, locale = "en" } = params;
  const localizedPackageName = resolveLocalizedPackageName({
    locale,
    packageName,
    packageNameI18n,
  });

  const title = await getTranslation(locale, "notifications.subscriptionExpired.title", {
    packageName: localizedPackageName,
  });
  const message = await getTranslation(locale, "notifications.subscriptionExpired.message", {
    packageName: localizedPackageName,
  });
  const emailTemplate = await getSubscriptionExpiredEmailTemplate(localizedPackageName, locale);

  return createNotification({
    userId,
    title,
    message,
    type: "general",
    link: `/client/subscription`,
    locale,
    emailTemplate,
  });
}

const ROLE_NOTIFICATION_LINKS: Record<string, string> = {
  CLIENT: "/client",
  PROVIDER: "/provider",
  SUPER_ADMIN: "/admin",
};

export async function sendWelcomeEmail(params: {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  locale?: string;
}) {
  const { userId, userName, userEmail, userRole, locale = "en" } = params;

  const title = await getTranslation(locale, "notifications.welcome.title", { userName });
  const message = await getTranslation(locale, "notifications.welcome.message", { userName });
  const emailTemplate = await getWelcomeEmailTemplate(userName, userRole, locale);
  const notificationLink = ROLE_NOTIFICATION_LINKS[userRole] || "/";

  try {
    // Don't block registration on SMTP; in-app welcome still lands immediately.
    void sendEmail({
      to: userEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    await createNotification({
      userId,
      title,
      message,
      type: "general",
      link: notificationLink,
      sendEmail: false,
      locale,
      sseI18n: {
        titleKey: "notifications.welcome.title",
        titleParams: { userName },
        messageKey: "notifications.welcome.message",
        messageParams: { userName },
      },
    });

    logger.info(`Welcome notification created for ${userEmail}`);
  } catch (error) {
    logger.error(`Failed to send welcome notification to ${userEmail}:`, error);
  }
}
