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
  getPasswordResetEmailTemplate,
  getApplicationReceivedEmailTemplate,
  getAccountApprovedEmailTemplate,
  getAccountRejectedEmailTemplate,
  getNewRequestAvailableEmailTemplate,
  getProviderClaimedEmailTemplate,
  getRequestAcceptedEmailTemplate,
  getRatingSubmittedEmailTemplate,
  getWithdrawalReviewedEmailTemplate,
  getFinanceDisputeReviewedEmailTemplate,
  getRequestUnassignedEmailTemplate,
  getRequestCancelledEmailTemplate,
  getEarningsHoldReleasedEmailTemplate,
  getAccountDeactivatedEmailTemplate,
  getAccountReactivatedEmailTemplate,
  getRequestCreatedByAdminEmailTemplate,
  getRequestRestoredEmailTemplate,
  getAdminWithdrawalRequestedEmailTemplate,
  getAdminFinanceDisputeOpenedEmailTemplate,
  getAdminPaymentVerificationEmailTemplate,
  getPaymentApprovedEmailTemplate,
  getPaymentRejectedEmailTemplate,
  getPaymentProofReceivedEmailTemplate,
  getSubscriptionStartedEmailTemplate,
  getSubscriptionCancelledEmailTemplate,
  getPasswordChangedEmailTemplate,
} from "./email";
import { sendNotificationToUser } from "./sse-utils";
import { getTranslation } from "./i18n-helper";
import { logger } from "@/lib/logger";
import { formatMoneyAmount } from "@/lib/utils";

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
  /** Optional request id for clients to mark unread / refresh lists. */
  requestId?: string;
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
    data: { notificationId: string; requestId?: string };
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
    requestId,
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
    data: {
      notificationId: notification.id,
      ...(requestId ? { requestId } : {}),
    },
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
    where: { role: { in: ["SUPER_ADMIN", "FINANCE_MANAGER"] } },
    select: { id: true, email: true },
  });

  const title = await getTranslation(locale, "notifications.paymentVerification.title");
  const formattedAmount = formatMoneyAmount(amount, locale);
  const message = await getTranslation(locale, "notifications.paymentVerification.message", {
    clientNameOrEmail,
    amount: formattedAmount,
    currency,
  });
  const link = "/admin/payments";
  const emailTemplate = await getAdminPaymentVerificationEmailTemplate({
    clientNameOrEmail,
    amount: formattedAmount,
    currency,
    locale,
  });

  await Promise.all(
    admins.map(async (admin) =>
      createNotification({
        userId: admin.id,
        title,
        message,
        type: "general",
        link,
        locale,
        emailTemplate,
        sseI18n: {
          titleKey: "notifications.paymentVerification.title",
          messageKey: "notifications.paymentVerification.message",
          messageParams: {
            clientNameOrEmail,
            amount: formattedAmount,
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
    where: { role: { in: ["SUPER_ADMIN", "FINANCE_MANAGER"] } },
    select: { id: true },
  });

  const title = await getTranslation(locale, "notifications.withdrawalRequested.title");
  const formattedAmount = formatMoneyAmount(amountUsd, locale);
  const message = await getTranslation(locale, "notifications.withdrawalRequested.message", {
    providerNameOrEmail,
    amount: formattedAmount,
  });
  const emailTemplate = await getAdminWithdrawalRequestedEmailTemplate({
    providerNameOrEmail,
    amount: formattedAmount,
    locale,
  });

  await Promise.all(
    admins.map(async (admin) =>
      createNotification({
        userId: admin.id,
        title,
        message,
        type: "general",
        link: "/admin/finance",
        locale,
        emailTemplate,
        sseI18n: {
          titleKey: "notifications.withdrawalRequested.title",
          messageKey: "notifications.withdrawalRequested.message",
          messageParams: {
            providerNameOrEmail,
            amount: formattedAmount,
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
  const formattedAmount = formatMoneyAmount(amountUsd, locale);

  const title = await getTranslation(locale, `notifications.${key}.title`);
  const message = await getTranslation(locale, `notifications.${key}.message`, {
    amount: formattedAmount,
    reason,
  });
  const emailTemplate = await getWithdrawalReviewedEmailTemplate({
    status,
    amount: formattedAmount,
    reason,
    locale,
  });

  return createNotification({
    userId: providerId,
    title,
    message,
    type: "general",
    link: "/provider/wallet",
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: `notifications.${key}.title`,
      messageKey: `notifications.${key}.message`,
      messageParams: {
        amount: formattedAmount,
        reason,
      },
    },
  });
}

export async function notifyAdminsFinanceDisputeOpened(params: {
  providerNameOrEmail: string;
  locale?: string;
}) {
  const { providerNameOrEmail, locale = "en" } = params;

  const admins = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "FINANCE_MANAGER"] } },
    select: { id: true },
  });

  const title = await getTranslation(locale, "notifications.financeDisputeOpened.title");
  const message = await getTranslation(locale, "notifications.financeDisputeOpened.message", {
    providerNameOrEmail,
  });
  const emailTemplate = await getAdminFinanceDisputeOpenedEmailTemplate({
    providerNameOrEmail,
    locale,
  });

  await Promise.all(
    admins.map(async (admin) =>
      createNotification({
        userId: admin.id,
        title,
        message,
        type: "general",
        link: "/admin/finance",
        locale,
        emailTemplate,
        sseI18n: {
          titleKey: "notifications.financeDisputeOpened.title",
          messageKey: "notifications.financeDisputeOpened.message",
          messageParams: { providerNameOrEmail },
        },
      })
    )
  );
}

export async function notifyProviderFinanceDisputeReviewed(params: {
  providerId: string;
  status: "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  note: string;
  locale?: string;
}) {
  const { providerId, status, note, locale = "en" } = params;
  const statusLabel = status.replaceAll("_", " ").toLowerCase();

  const title = await getTranslation(locale, "notifications.financeDisputeReviewed.title");
  const message = await getTranslation(locale, "notifications.financeDisputeReviewed.message", {
    status: statusLabel,
    note,
  });
  const emailTemplate = await getFinanceDisputeReviewedEmailTemplate({
    status: statusLabel,
    note,
    locale,
  });

  return createNotification({
    userId: providerId,
    title,
    message,
    type: "general",
    link: "/provider/wallet",
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.financeDisputeReviewed.title",
      messageKey: "notifications.financeDisputeReviewed.message",
      messageParams: {
        status: statusLabel,
        note,
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
  if (recipientRole === "PROJECT_MANAGER" || recipientRole === "SUPER_ADMIN") {
    return `/admin/requests/${requestId}`;
  }
  if (recipientRole === "FINANCE_MANAGER") {
    return `/admin/finance`;
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
    requestId,
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
    requestId,
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
    link: `/provider/requests/${requestId}`,
    requestId,
    locale,
    emailTemplate,
  });
}

/** Client: a provider claimed their PENDING request (work has not started yet). */
export async function notifyClientProviderClaimed(params: {
  requestId: string;
  clientId: string;
  providerName: string;
  locale?: string;
}) {
  const { requestId, clientId, providerName, locale = "en" } = params;

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { title: true },
  });

  if (!request) return;

  const title = await getTranslation(locale, "notifications.providerClaimed.title");
  const message = await getTranslation(locale, "notifications.providerClaimed.message", {
    requestTitle: request.title,
    providerName,
  });
  const emailTemplate = await getProviderClaimedEmailTemplate(request.title, providerName, locale);

  return createNotification({
    userId: clientId,
    title,
    message,
    type: "assignment",
    link: `/client/requests/${requestId}`,
    requestId,
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.providerClaimed.title",
      messageKey: "notifications.providerClaimed.message",
      messageParams: {
        requestTitle: request.title,
        providerName,
      },
    },
  });
}

export async function notifyNewRequestAvailable(params: {
  providerId: string;
  requestId: string;
  serviceName: string;
  requestTitle: string;
  locale?: string;
}) {
  const { providerId, requestId, serviceName, requestTitle, locale = "en" } = params;

  const title = await getTranslation(locale, "notifications.newRequestAvailable.title");
  const message = await getTranslation(locale, "notifications.newRequestAvailable.message", {
    serviceName,
    requestTitle,
  });
  const emailTemplate = await getNewRequestAvailableEmailTemplate(
    serviceName,
    requestTitle,
    locale
  );

  return createNotification({
    userId: providerId,
    title,
    message,
    type: "general",
    link: `/provider/available/${requestId}`,
    requestId,
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.newRequestAvailable.title",
      messageKey: "notifications.newRequestAvailable.message",
      messageParams: { serviceName, requestTitle },
    },
  });
}

export async function notifyClientRequestAccepted(params: {
  requestId: string;
  clientId: string;
  requestTitle: string;
  locale?: string;
}) {
  const { requestId, clientId, requestTitle, locale = "en" } = params;

  const title = await getTranslation(locale, "notifications.requestAccepted.title");
  const message = await getTranslation(locale, "notifications.requestAccepted.message", {
    requestTitle,
  });
  const emailTemplate = await getRequestAcceptedEmailTemplate(requestTitle, locale);

  return createNotification({
    userId: clientId,
    title,
    message,
    type: "status_change",
    link: `/client/requests/${requestId}`,
    requestId,
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.requestAccepted.title",
      messageKey: "notifications.requestAccepted.message",
      messageParams: { requestTitle },
    },
  });
}

export async function notifyProviderRatingSubmitted(params: {
  providerId: string;
  requestId: string;
  requestTitle: string;
  rating: number;
  locale?: string;
}) {
  const { providerId, requestId, requestTitle, rating, locale = "en" } = params;

  const title = await getTranslation(locale, "notifications.ratingSubmitted.title");
  const message = await getTranslation(locale, "notifications.ratingSubmitted.message", {
    rating: String(rating),
    requestTitle,
  });
  const emailTemplate = await getRatingSubmittedEmailTemplate(requestTitle, rating, locale);

  return createNotification({
    userId: providerId,
    title,
    message,
    type: "general",
    link: `/provider/requests/${requestId}`,
    requestId,
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.ratingSubmitted.title",
      messageKey: "notifications.ratingSubmitted.message",
      messageParams: { rating: String(rating), requestTitle },
    },
  });
}

export async function notifyProviderUnassigned(params: {
  providerId: string;
  requestId: string;
  requestTitle: string;
  locale?: string;
}) {
  const { providerId, requestId, requestTitle, locale = "en" } = params;

  const title = await getTranslation(locale, "notifications.requestUnassigned.title");
  const message = await getTranslation(locale, "notifications.requestUnassigned.message", {
    requestTitle,
  });
  const emailTemplate = await getRequestUnassignedEmailTemplate(requestTitle, locale);

  return createNotification({
    userId: providerId,
    title,
    message,
    type: "assignment",
    link: `/provider/available/${requestId}`,
    requestId,
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.requestUnassigned.title",
      messageKey: "notifications.requestUnassigned.message",
      messageParams: { requestTitle },
    },
  });
}

export async function notifyRequestCancelled(params: {
  userId: string;
  requestId: string;
  requestTitle: string;
  role: "PROVIDER" | "CLIENT";
  locale?: string;
}) {
  const { userId, requestId, requestTitle, role, locale = "en" } = params;
  const link =
    role === "CLIENT" ? `/client/requests/${requestId}` : `/provider/requests/${requestId}`;

  const title = await getTranslation(locale, "notifications.requestCancelled.title");
  const message = await getTranslation(locale, "notifications.requestCancelled.message", {
    requestTitle,
  });
  const emailTemplate = await getRequestCancelledEmailTemplate(requestTitle, locale, role);

  return createNotification({
    userId,
    title,
    message,
    type: "status_change",
    link,
    requestId,
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.requestCancelled.title",
      messageKey: "notifications.requestCancelled.message",
      messageParams: { requestTitle },
    },
  });
}

export async function notifyProviderEarningsHoldReleased(params: {
  providerId: string;
  amountUsd: number;
  locale?: string;
}) {
  const { providerId, amountUsd, locale = "en" } = params;
  const formattedAmount = formatMoneyAmount(amountUsd, locale);

  const title = await getTranslation(locale, "notifications.earningsHoldReleased.title");
  const message = await getTranslation(locale, "notifications.earningsHoldReleased.message", {
    amount: formattedAmount,
  });
  const emailTemplate = await getEarningsHoldReleasedEmailTemplate({
    amount: formattedAmount,
    locale,
  });

  return createNotification({
    userId: providerId,
    title,
    message,
    type: "general",
    link: "/provider/wallet",
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.earningsHoldReleased.title",
      messageKey: "notifications.earningsHoldReleased.message",
      messageParams: { amount: formattedAmount },
    },
  });
}

export async function notifyClientRequestCreatedByAdmin(params: {
  clientId: string;
  requestId: string;
  requestTitle: string;
  locale?: string;
}) {
  const { clientId, requestId, requestTitle, locale = "en" } = params;

  const title = await getTranslation(locale, "notifications.requestCreatedByAdmin.title");
  const message = await getTranslation(locale, "notifications.requestCreatedByAdmin.message", {
    requestTitle,
  });
  const emailTemplate = await getRequestCreatedByAdminEmailTemplate(requestTitle, locale);

  return createNotification({
    userId: clientId,
    title,
    message,
    type: "general",
    link: `/client/requests/${requestId}`,
    requestId,
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.requestCreatedByAdmin.title",
      messageKey: "notifications.requestCreatedByAdmin.message",
      messageParams: { requestTitle },
    },
  });
}

export async function notifyRequestRestored(params: {
  userId: string;
  requestId: string;
  requestTitle: string;
  role: "PROVIDER" | "CLIENT";
  locale?: string;
}) {
  const { userId, requestId, requestTitle, role, locale = "en" } = params;
  const link =
    role === "CLIENT" ? `/client/requests/${requestId}` : `/provider/requests/${requestId}`;

  const title = await getTranslation(locale, "notifications.requestRestored.title");
  const message = await getTranslation(locale, "notifications.requestRestored.message", {
    requestTitle,
  });
  const emailTemplate = await getRequestRestoredEmailTemplate(requestTitle, locale, role);

  return createNotification({
    userId,
    title,
    message,
    type: "status_change",
    link,
    requestId,
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.requestRestored.title",
      messageKey: "notifications.requestRestored.message",
      messageParams: { requestTitle },
    },
  });
}

export async function notifyAccountActivationChanged(params: {
  userId: string;
  userName: string;
  isActive: boolean;
  locale?: string;
}) {
  const { userId, userName, isActive, locale = "en" } = params;
  const key = isActive ? "accountReactivated" : "accountDeactivated";

  const title = await getTranslation(locale, `notifications.${key}.title`);
  const message = await getTranslation(locale, `notifications.${key}.message`);
  const emailTemplate = isActive
    ? await getAccountReactivatedEmailTemplate({ userName, locale })
    : await getAccountDeactivatedEmailTemplate({ userName, locale });

  return createNotification({
    userId,
    title,
    message,
    type: "general",
    link: isActive ? "/auth/login" : "/",
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: `notifications.${key}.title`,
      messageKey: `notifications.${key}.message`,
    },
  });
}

export async function notifyClientPaymentApproved(params: {
  userId: string;
  packageName: string;
  locale?: string;
}) {
  const { userId, packageName, locale = "en" } = params;

  const title = await getTranslation(locale, "notifications.paymentApproved.title");
  const message = await getTranslation(locale, "notifications.paymentApproved.message", {
    packageName,
  });
  const emailTemplate = await getPaymentApprovedEmailTemplate(packageName, locale);

  return createNotification({
    userId,
    title,
    message,
    type: "general",
    link: "/client/subscription",
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.paymentApproved.title",
      messageKey: "notifications.paymentApproved.message",
      messageParams: { packageName },
    },
  });
}

export async function notifyClientPaymentRejected(params: {
  userId: string;
  reason: string;
  locale?: string;
}) {
  const { userId, reason, locale = "en" } = params;

  const title = await getTranslation(locale, "notifications.paymentRejected.title");
  const message = await getTranslation(locale, "notifications.paymentRejected.message", {
    reason,
  });
  const emailTemplate = await getPaymentRejectedEmailTemplate(reason, locale);

  return createNotification({
    userId,
    title,
    message,
    type: "general",
    link: "/client/subscription",
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.paymentRejected.title",
      messageKey: "notifications.paymentRejected.message",
      messageParams: { reason },
    },
  });
}

export async function notifyClientPaymentProofReceived(params: {
  userId: string;
  packageName: string;
  amount: number;
  currency: string;
  locale?: string;
}) {
  const { userId, packageName, amount, currency, locale = "en" } = params;
  const formattedAmount = formatMoneyAmount(amount, locale);

  const title = await getTranslation(locale, "notifications.paymentProofReceived.title");
  const message = await getTranslation(locale, "notifications.paymentProofReceived.message", {
    packageName,
    amount: formattedAmount,
    currency,
  });
  const emailTemplate = await getPaymentProofReceivedEmailTemplate({
    amount: formattedAmount,
    currency,
    packageName,
    locale,
  });

  return createNotification({
    userId,
    title,
    message,
    type: "general",
    link: "/client/subscription",
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.paymentProofReceived.title",
      messageKey: "notifications.paymentProofReceived.message",
      messageParams: {
        packageName,
        amount: formattedAmount,
        currency,
      },
    },
  });
}

export async function notifyClientSubscriptionStarted(params: {
  userId: string;
  packageName: string;
  locale?: string;
}) {
  const { userId, packageName, locale = "en" } = params;

  const title = await getTranslation(locale, "notifications.subscriptionStarted.title");
  const message = await getTranslation(locale, "notifications.subscriptionStarted.message", {
    packageName,
  });
  const emailTemplate = await getSubscriptionStartedEmailTemplate(packageName, locale);

  return createNotification({
    userId,
    title,
    message,
    type: "general",
    link: "/client/payment",
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.subscriptionStarted.title",
      messageKey: "notifications.subscriptionStarted.message",
      messageParams: { packageName },
    },
  });
}

export async function notifyClientSubscriptionCancelled(params: {
  userId: string;
  wasActive: boolean;
  locale?: string;
}) {
  const { userId, wasActive, locale = "en" } = params;
  const messageKey = wasActive
    ? "notifications.subscriptionCancelled.activeMessage"
    : "notifications.subscriptionCancelled.pendingMessage";

  const title = await getTranslation(locale, "notifications.subscriptionCancelled.title");
  const message = await getTranslation(locale, messageKey);
  const emailTemplate = await getSubscriptionCancelledEmailTemplate({ wasActive, locale });

  return createNotification({
    userId,
    title,
    message,
    type: "general",
    link: "/client/subscription",
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.subscriptionCancelled.title",
      messageKey,
    },
  });
}

export async function notifyPasswordChanged(params: {
  userId: string;
  userName: string;
  locale?: string;
}) {
  const { userId, userName, locale = "en" } = params;

  const title = await getTranslation(locale, "notifications.passwordChanged.title");
  const message = await getTranslation(locale, "notifications.passwordChanged.message");
  const emailTemplate = await getPasswordChangedEmailTemplate({ userName, locale });

  return createNotification({
    userId,
    title,
    message,
    type: "general",
    link: "/auth/login",
    locale,
    emailTemplate,
    sseI18n: {
      titleKey: "notifications.passwordChanged.title",
      messageKey: "notifications.passwordChanged.message",
    },
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
  PROJECT_MANAGER: "/admin/requests",
  FINANCE_MANAGER: "/admin/finance",
};

export async function sendWelcomeEmail(params: {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  locale?: string;
  /** When false, only the in-app welcome is created (avoids duplicate approve emails). */
  email?: boolean;
}) {
  const { userId, userName, userEmail, userRole, locale = "en", email = true } = params;

  const title = await getTranslation(locale, "notifications.welcome.title", { userName });
  const message = await getTranslation(locale, "notifications.welcome.message", { userName });
  const emailTemplate = await getWelcomeEmailTemplate(userName, userRole, locale);
  const notificationLink = ROLE_NOTIFICATION_LINKS[userRole] || "/";

  try {
    // Don't block registration on SMTP; in-app welcome still lands immediately.
    if (email) {
      void sendEmail({
        to: userEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    }

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

/** Sent when a client/provider submits an application that needs admin approval. */
export async function sendApplicationReceivedEmail(params: {
  userEmail: string;
  userName: string;
  userRole: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  const template = await getApplicationReceivedEmailTemplate({
    userName: params.userName,
    userRole: params.userRole,
    locale,
  });

  void sendEmail({
    to: params.userEmail,
    subject: template.subject,
    html: template.html,
  });
}

/** Sent when admin approves a pending account (welcome side effects run separately). */
export async function sendAccountApprovedEmail(params: {
  userEmail: string;
  userName: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  const template = await getAccountApprovedEmailTemplate({
    userName: params.userName,
    locale,
  });

  void sendEmail({
    to: params.userEmail,
    subject: template.subject,
    html: template.html,
  });
}

export async function sendAccountRejectedEmail(params: {
  userEmail: string;
  userName: string;
  reason?: string | null;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  const template = await getAccountRejectedEmailTemplate({
    userName: params.userName,
    reason: params.reason,
    locale,
  });

  void sendEmail({
    to: params.userEmail,
    subject: template.subject,
    html: template.html,
  });
}

export async function sendPasswordResetEmail(params: {
  userEmail: string;
  userName: string;
  resetUrl: string;
  expiresInMinutes: number;
  locale?: string;
}): Promise<boolean> {
  const locale = params.locale ?? "en";
  const template = await getPasswordResetEmailTemplate({
    userName: params.userName,
    resetUrl: params.resetUrl,
    expiresInMinutes: params.expiresInMinutes,
    locale,
  });

  return sendEmail({
    to: params.userEmail,
    subject: template.subject,
    html: template.html,
  });
}

/** In-app + SSE alert for super admins when a client/creator applies (or re-applies). */
export async function notifyAdminsNewUserRegistration(params: {
  userName: string;
  userEmail: string;
  userRole: "CLIENT" | "PROVIDER";
  userId: string;
  reapplied?: boolean;
  locale?: string;
}) {
  const { userName, userEmail, userRole, reapplied = false, locale = "en" } = params;

  const admins = await db.user.findMany({
    where: { role: "SUPER_ADMIN", deletedAt: null },
    select: { id: true },
  });

  if (admins.length === 0) return { notifiedAdmins: 0 };

  const roleLabelKey =
    userRole === "PROVIDER"
      ? "notifications.newUserRegistration.roleCreator"
      : "notifications.newUserRegistration.roleClient";
  const roleLabel = await getTranslation(locale, roleLabelKey);
  const titleKey = reapplied
    ? "notifications.newUserRegistration.reapplyTitle"
    : "notifications.newUserRegistration.title";
  const messageKey = reapplied
    ? "notifications.newUserRegistration.reapplyMessage"
    : "notifications.newUserRegistration.message";

  const title = await getTranslation(locale, titleKey);
  const message = await getTranslation(locale, messageKey, {
    userName,
    userEmail,
    role: roleLabel,
  });
  const link = "/admin/users";

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
          titleKey,
          messageKey,
          messageParams: {
            userName,
            userEmail,
            role: roleLabel,
          },
        },
      })
    )
  );

  return { notifiedAdmins: admins.length };
}

export async function notifyAdminsContactMessage(params: {
  fullName: string;
  email: string;
  topic?: string | null;
  messageId: string;
  locale?: string;
}) {
  const { fullName, email, topic, messageId, locale = "en" } = params;

  const admins = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "PROJECT_MANAGER"] }, deletedAt: null },
    select: { id: true },
  });

  const title = await getTranslation(locale, "notifications.contactMessage.title");
  const message = await getTranslation(locale, "notifications.contactMessage.message", {
    fullName,
    email,
    topic: topic || "—",
  });
  const link = `/admin/contacts?id=${messageId}`;

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
          titleKey: "notifications.contactMessage.title",
          messageKey: "notifications.contactMessage.message",
          messageParams: {
            fullName,
            email,
            topic: topic || "—",
          },
        },
      })
    )
  );

  return { notifiedAdmins: admins.length };
}
