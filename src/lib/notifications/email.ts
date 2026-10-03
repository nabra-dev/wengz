import nodemailer from "nodemailer";
import { getTranslation } from "./i18n-helper";
import { logger } from "@/lib/logger";
import {
  appBaseUrl,
  contactEmailAddress,
  emailButton,
  emailCallout,
  emailMetaRows,
  emailPanel,
  emailParagraph,
  EMAIL_COLORS,
  wrapEmailHtml,
} from "./email-layout";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  // Use environment variables for email configuration
  const emailConfig = {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number.parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER?.trim(),
      // Gmail app passwords are often copied with spaces; strip whitespace safely.
      pass: process.env.EMAIL_PASSWORD?.replaceAll(/\s+/g, ""),
    },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  };

  transporter = nodemailer.createTransport(emailConfig);
  return transporter;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: EmailOptions): Promise<boolean> {
  // Skip if email is not configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    logger.warn("Email not configured. Skipping email notification.");
    return false;
  }

  try {
    const transport = getTransporter();

    await transport?.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      replyTo,
      subject,
      html,
      text: text || html.replaceAll(/<[^>]*>/g, ""), // Strip HTML if no text provided
    });

    return true;
  } catch (error) {
    logger.error("Failed to send email:", error);
    return false;
  }
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, Tahoma, sans-serif";

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

/** Absolute app URL for email CTAs (deep link when path provided). */
function appUrl(path?: string | null): string {
  const base = appBaseUrl().replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function quickStartSteps(
  locale: string,
  role: "client" | "provider" | "admin"
): Promise<string> {
  const steps = await Promise.all(
    [1, 2, 3].map(async (n) => {
      const title = await getTranslation(
        locale,
        `notifications.welcome.emailBody.${role}.step${n}Title`
      );
      const desc = await getTranslation(
        locale,
        `notifications.welcome.emailBody.${role}.step${n}Desc`
      );
      return `
        <tr>
          <td style="padding: 0 0 16px;">
            <div style="font-family: ${FONT}; font-size: 14px; font-weight: 700; color: ${EMAIL_COLORS.purple}; margin-bottom: 4px;">${title}</div>
            <div style="font-family: ${FONT}; font-size: 14px; line-height: 1.5; color: ${EMAIL_COLORS.muted};">${desc}</div>
          </td>
        </tr>`;
    })
  );
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${steps.join("")}</table>`;
}

// Email templates
export async function getNewMessageEmailTemplate(
  senderName: string,
  requestTitle: string,
  messagePreview: string,
  locale: string = "en",
  ctaPath?: string | null
) {
  const subject = await getTranslation(locale, "notifications.newMessage.emailSubject", {
    senderName,
  });
  const heading = await getTranslation(locale, "notifications.newMessage.emailBody.heading");
  const intro = await getTranslation(locale, "notifications.newMessage.emailBody.intro", {
    senderName,
    requestTitle,
  });
  const viewButton = await getTranslation(locale, "notifications.newMessage.emailBody.viewButton");

  const html = await wrapEmailHtml(
    `
      ${emailParagraph(intro)}
      ${emailPanel(`<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:${EMAIL_COLORS.ink};">${messagePreview}</p>`)}
      ${emailButton(viewButton, appUrl(ctaPath))}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getStatusChangeEmailTemplate(
  requestTitle: string,
  oldStatus: string,
  newStatus: string,
  locale: string = "en",
  ctaPath?: string | null
) {
  const subject = await getTranslation(locale, "notifications.statusChange.emailSubject", {
    requestTitle,
  });
  const heading = await getTranslation(locale, "notifications.statusChange.emailBody.heading");
  const intro = await getTranslation(locale, "notifications.statusChange.emailBody.intro", {
    requestTitle,
  });
  const fromLabel = await getTranslation(locale, "notifications.statusChange.emailBody.from");
  const toLabel = await getTranslation(locale, "notifications.statusChange.emailBody.to");
  const viewButton = await getTranslation(
    locale,
    "notifications.statusChange.emailBody.viewButton"
  );

  const html = await wrapEmailHtml(
    `
      ${emailParagraph(intro)}
      ${emailMetaRows([
        { label: fromLabel, value: statusLabel(oldStatus) },
        { label: toLabel, value: statusLabel(newStatus) },
      ])}
      ${emailButton(viewButton, appUrl(ctaPath))}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getAssignmentEmailTemplate(
  requestTitle: string,
  _providerName: string,
  locale: string = "en",
  requestId?: string
) {
  const subject = await getTranslation(locale, "notifications.assignment.emailSubject", {
    requestTitle,
  });
  const heading = await getTranslation(locale, "notifications.assignment.emailBody.heading");
  const intro = await getTranslation(locale, "notifications.assignment.emailBody.intro", {
    requestTitle,
  });
  const viewButton = await getTranslation(locale, "notifications.assignment.emailBody.viewButton");

  const html = await wrapEmailHtml(
    `
      ${emailParagraph(intro)}
      ${emailButton(viewButton, appUrl(requestId ? `/provider/requests/${requestId}` : "/provider/requests"))}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getApprovalReminderEmailTemplate(
  requestTitle: string,
  locale: string = "en",
  requestId?: string
) {
  const subject = await getTranslation(locale, "notifications.approvalReminder.emailSubject", {
    requestTitle,
  });
  const heading = await getTranslation(locale, "notifications.approvalReminder.emailBody.heading");
  const intro = await getTranslation(locale, "notifications.approvalReminder.emailBody.intro", {
    requestTitle,
  });
  const body = await getTranslation(locale, "notifications.approvalReminder.emailBody.message");
  const viewButton = await getTranslation(
    locale,
    "notifications.approvalReminder.emailBody.viewButton"
  );

  const html = await wrapEmailHtml(
    `
      ${emailParagraph(intro)}
      ${emailCallout(`<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;">${body}</p>`, "warning")}
      ${emailButton(viewButton, appUrl(requestId ? `/client/requests/${requestId}` : "/client/requests"), "warning")}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getSubscriptionExpiringEmailTemplate(
  packageName: string,
  daysRemaining: number,
  remainingCredits: number,
  locale: string = "en"
) {
  const subject = await getTranslation(locale, "notifications.subscriptionExpiring.emailSubject", {
    daysRemaining: daysRemaining.toString(),
  });
  const heading = await getTranslation(
    locale,
    "notifications.subscriptionExpiring.emailBody.heading"
  );
  const intro = await getTranslation(locale, "notifications.subscriptionExpiring.emailBody.intro", {
    packageName,
    daysRemaining: daysRemaining.toString(),
  });
  const remainingCreditsLabel = await getTranslation(
    locale,
    "notifications.subscriptionExpiring.emailBody.remainingCredits"
  );
  const expiryDateLabel = await getTranslation(
    locale,
    "notifications.subscriptionExpiring.emailBody.expiryDate"
  );
  const expiryDateValue = await getTranslation(
    locale,
    "notifications.subscriptionExpiring.emailBody.expiryDateValue",
    { daysRemaining: daysRemaining.toString() }
  );
  const message = await getTranslation(
    locale,
    "notifications.subscriptionExpiring.emailBody.message"
  );
  const renewButton = await getTranslation(
    locale,
    "notifications.subscriptionExpiring.emailBody.renewButton"
  );

  const html = await wrapEmailHtml(
    `
      ${emailParagraph(intro)}
      ${emailCallout(
        `<p style="margin:0 0 8px;font-family:${FONT};font-size:15px;"><strong>${remainingCreditsLabel}</strong> ${remainingCredits}</p>
         <p style="margin:0;font-family:${FONT};font-size:15px;"><strong>${expiryDateLabel}</strong> ${expiryDateValue}</p>`,
        "warning"
      )}
      ${emailParagraph(message)}
      ${emailButton(renewButton, `${appBaseUrl()}/client/subscription`, "warning")}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getSubscriptionExpiredEmailTemplate(
  packageName: string,
  locale: string = "en"
) {
  const subject = await getTranslation(locale, "notifications.subscriptionExpired.emailSubject");
  const heading = await getTranslation(
    locale,
    "notifications.subscriptionExpired.emailBody.heading"
  );
  const intro = await getTranslation(locale, "notifications.subscriptionExpired.emailBody.intro", {
    packageName,
  });
  const message = await getTranslation(
    locale,
    "notifications.subscriptionExpired.emailBody.message"
  );
  const message2 = await getTranslation(
    locale,
    "notifications.subscriptionExpired.emailBody.message2"
  );
  const renewButton = await getTranslation(
    locale,
    "notifications.subscriptionExpired.emailBody.renewButton"
  );

  const html = await wrapEmailHtml(
    `
      ${emailParagraph(intro)}
      ${emailCallout(
        `<p style="margin:0 0 8px;font-family:${FONT};font-size:15px;">${message}</p>
         <p style="margin:0;font-family:${FONT};font-size:15px;">${message2}</p>`,
        "danger"
      )}
      ${emailButton(renewButton, `${appBaseUrl()}/client/subscription`, "danger")}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getWelcomeEmailTemplate(
  userName: string,
  userRole: string,
  locale: string = "en"
) {
  let dashboardLink: string;
  if (userRole === "CLIENT") {
    dashboardLink = `${appBaseUrl()}/client`;
  } else if (userRole === "PROVIDER") {
    dashboardLink = `${appBaseUrl()}/provider`;
  } else {
    dashboardLink = `${appBaseUrl()}/admin`;
  }

  const subject = await getTranslation(locale, "notifications.welcome.emailSubject");
  const heading = await getTranslation(locale, "notifications.welcome.emailBody.heading");
  const subheading = await getTranslation(locale, "notifications.welcome.emailBody.subheading");
  const greeting = await getTranslation(locale, "notifications.welcome.emailBody.greeting", {
    userName,
  });
  const intro = await getTranslation(locale, "notifications.welcome.emailBody.intro");
  const quickStartTitle = await getTranslation(
    locale,
    "notifications.welcome.emailBody.quickStartTitle"
  );

  let roleKey: "client" | "provider" | "admin" = "admin";
  if (userRole === "CLIENT") roleKey = "client";
  else if (userRole === "PROVIDER") roleKey = "provider";

  const quickStartGuide = await quickStartSteps(locale, roleKey);

  const dashboardButton = await getTranslation(
    locale,
    "notifications.welcome.emailBody.dashboardButton"
  );
  const proTip = await getTranslation(locale, "notifications.welcome.emailBody.proTip");
  const proTipMessage = await getTranslation(
    locale,
    "notifications.welcome.emailBody.proTipMessage"
  );
  const needHelp = await getTranslation(locale, "notifications.welcome.emailBody.needHelp");
  const emailUs = await getTranslation(locale, "notifications.welcome.emailBody.emailUs");
  const contactSupport = await getTranslation(
    locale,
    "notifications.welcome.emailBody.contactSupport"
  );
  const disclaimer = await getTranslation(locale, "notifications.welcome.emailBody.disclaimer");
  const contact = contactEmailAddress();

  const hero = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin: 0 0 24px; background-color: ${EMAIL_COLORS.purple}; border-radius: 14px;">
      <tr>
        <td style="padding: 24px 22px;">
          <div style="font-family: ${FONT}; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: ${EMAIL_COLORS.yellow}; margin-bottom: 8px;">${subheading}</div>
          <div style="font-family: ${FONT}; font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">${greeting}</div>
          <div style="font-family: ${FONT}; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.9);">${intro}</div>
        </td>
      </tr>
    </table>`;

  const footerExtra = `
    <p style="margin: 0 0 8px; font-family: ${FONT}; font-size: 13px; color: ${EMAIL_COLORS.muted};">${needHelp}</p>
    <p style="margin: 0 0 4px; font-family: ${FONT}; font-size: 13px; color: ${EMAIL_COLORS.muted};">
      ${emailUs}
      <a href="mailto:${contact}" style="color: ${EMAIL_COLORS.purple}; text-decoration: none; font-weight: 600;">${contact}</a>
    </p>
    <p style="margin: 0 0 12px; font-family: ${FONT}; font-size: 13px; color: ${EMAIL_COLORS.muted};">${contactSupport}</p>
    <p style="margin: 0 0 12px; font-family: ${FONT}; font-size: 12px; color: ${EMAIL_COLORS.faint};">${disclaimer}</p>`;

  const html = await wrapEmailHtml(
    `
      ${hero}
      <div style="font-family: ${FONT}; font-size: 16px; font-weight: 700; color: ${EMAIL_COLORS.ink}; margin: 0 0 12px;">${quickStartTitle}</div>
      ${emailPanel(quickStartGuide)}
      ${emailButton(dashboardButton, dashboardLink)}
      ${emailCallout(`<strong>${proTip}</strong> ${proTipMessage}`, "warning")}
    `,
    {
      locale,
      title: heading,
      preheader: subject,
      hideFooter: true,
      footerExtraHtml: footerExtra,
    }
  );

  return { subject, html };
}

export async function getPasswordResetEmailTemplate(params: {
  userName: string;
  resetUrl: string;
  expiresInMinutes: number;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  const subject = await getTranslation(locale, "notifications.passwordReset.emailSubject");
  const heading = await getTranslation(locale, "notifications.passwordReset.emailBody.heading");
  const greeting = await getTranslation(locale, "notifications.passwordReset.emailBody.greeting", {
    userName: params.userName,
  });
  const intro = await getTranslation(locale, "notifications.passwordReset.emailBody.intro");
  const button = await getTranslation(locale, "notifications.passwordReset.emailBody.button");
  const expiry = await getTranslation(locale, "notifications.passwordReset.emailBody.expiry", {
    minutes: String(params.expiresInMinutes),
  });
  const ignore = await getTranslation(locale, "notifications.passwordReset.emailBody.ignore");
  const linkFallback = await getTranslation(
    locale,
    "notifications.passwordReset.emailBody.linkFallback"
  );

  const html = await wrapEmailHtml(
    `
      ${emailParagraph(greeting)}
      ${emailParagraph(intro)}
      ${emailButton(button, params.resetUrl)}
      ${emailParagraph(expiry, true)}
      ${emailParagraph(ignore, true)}
      ${emailPanel(
        `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;color:${EMAIL_COLORS.muted};">${linkFallback}</p>
         <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;color:${EMAIL_COLORS.faint};word-break:break-all;">${params.resetUrl}</p>`
      )}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getApplicationReceivedEmailTemplate(params: {
  userName: string;
  userRole: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  const subject = await getTranslation(locale, "notifications.applicationReceived.emailSubject");
  const heading = await getTranslation(
    locale,
    "notifications.applicationReceived.emailBody.heading"
  );
  const greeting = await getTranslation(
    locale,
    "notifications.applicationReceived.emailBody.greeting",
    { userName: params.userName }
  );
  const body = await getTranslation(locale, "notifications.applicationReceived.emailBody.body");
  const roleNote =
    params.userRole === "PROVIDER"
      ? await getTranslation(locale, "notifications.applicationReceived.emailBody.providerNote")
      : await getTranslation(locale, "notifications.applicationReceived.emailBody.clientNote");

  const html = await wrapEmailHtml(
    `
      ${emailParagraph(greeting)}
      ${emailParagraph(body)}
      ${emailCallout(roleNote, "warning")}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getAccountApprovedEmailTemplate(params: {
  userName: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  const subject = await getTranslation(locale, "notifications.accountApproved.emailSubject");
  const heading = await getTranslation(locale, "notifications.accountApproved.emailBody.heading");
  const greeting = await getTranslation(
    locale,
    "notifications.accountApproved.emailBody.greeting",
    { userName: params.userName }
  );
  const body = await getTranslation(locale, "notifications.accountApproved.emailBody.body");
  const cta = await getTranslation(locale, "notifications.accountApproved.emailBody.cta");
  const loginUrl = `${appBaseUrl()}/auth/login`;

  const html = await wrapEmailHtml(
    `
      ${emailParagraph(greeting)}
      ${emailParagraph(body)}
      ${emailButton(cta, loginUrl, "success")}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getAccountRejectedEmailTemplate(params: {
  userName: string;
  reason?: string | null;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  const subject = await getTranslation(locale, "notifications.accountRejected.emailSubject");
  const heading = await getTranslation(locale, "notifications.accountRejected.emailBody.heading");
  const greeting = await getTranslation(
    locale,
    "notifications.accountRejected.emailBody.greeting",
    { userName: params.userName }
  );
  const body = await getTranslation(locale, "notifications.accountRejected.emailBody.body");
  const reasonLabel = await getTranslation(
    locale,
    "notifications.accountRejected.emailBody.reasonLabel"
  );
  const safeReason = params.reason?.replaceAll("<", "&lt;") ?? null;

  const html = await wrapEmailHtml(
    `
      ${emailParagraph(greeting)}
      ${emailParagraph(body)}
      ${safeReason ? emailCallout(`<strong>${reasonLabel}</strong> ${safeReason}`, "danger") : ""}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

async function buildSimpleCtaEmail(params: {
  locale: string;
  subjectKey: string;
  subjectParams?: Record<string, string>;
  headingKey: string;
  introKey: string;
  introParams?: Record<string, string>;
  bodyKey?: string;
  bodyParams?: Record<string, string>;
  buttonKey: string;
  href: string;
  calloutVariant?: "warning" | "danger" | "success";
  metaRows?: Array<{ label: string; value: string }>;
}): Promise<{ subject: string; html: string }> {
  const subject = await getTranslation(params.locale, params.subjectKey, params.subjectParams);
  const heading = await getTranslation(params.locale, params.headingKey);
  const intro = await getTranslation(params.locale, params.introKey, params.introParams);
  const button = await getTranslation(params.locale, params.buttonKey);
  const body = params.bodyKey
    ? await getTranslation(params.locale, params.bodyKey, params.bodyParams)
    : null;

  const html = await wrapEmailHtml(
    `
      ${emailParagraph(intro)}
      ${params.metaRows?.length ? emailMetaRows(params.metaRows) : ""}
      ${
        body
          ? emailCallout(
              `<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;">${body}</p>`,
              params.calloutVariant ?? "warning"
            )
          : ""
      }
      ${emailButton(button, params.href)}
    `,
    { locale: params.locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getNewRequestAvailableEmailTemplate(
  serviceName: string,
  requestTitle: string,
  locale: string = "en",
  requestId?: string
) {
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.newRequestAvailable.emailSubject",
    subjectParams: { serviceName },
    headingKey: "notifications.newRequestAvailable.emailBody.heading",
    introKey: "notifications.newRequestAvailable.emailBody.intro",
    introParams: { serviceName, requestTitle },
    buttonKey: "notifications.newRequestAvailable.emailBody.viewButton",
    href: appUrl(requestId ? `/provider/available/${requestId}` : "/provider/available"),
  });
}

export async function getProviderClaimedEmailTemplate(
  requestTitle: string,
  providerName: string,
  locale: string = "en",
  requestId?: string
) {
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.providerClaimed.emailSubject",
    subjectParams: { requestTitle },
    headingKey: "notifications.providerClaimed.emailBody.heading",
    introKey: "notifications.providerClaimed.emailBody.intro",
    introParams: { requestTitle, providerName },
    buttonKey: "notifications.providerClaimed.emailBody.viewButton",
    href: appUrl(requestId ? `/client/requests/${requestId}` : "/client/requests"),
  });
}

export async function getRequestAcceptedEmailTemplate(
  requestTitle: string,
  locale: string = "en",
  requestId?: string
) {
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.requestAccepted.emailSubject",
    subjectParams: { requestTitle },
    headingKey: "notifications.requestAccepted.emailBody.heading",
    introKey: "notifications.requestAccepted.emailBody.intro",
    introParams: { requestTitle },
    buttonKey: "notifications.requestAccepted.emailBody.viewButton",
    href: appUrl(requestId ? `/client/requests/${requestId}` : "/client/requests"),
  });
}

export async function getRatingSubmittedEmailTemplate(
  requestTitle: string,
  rating: number,
  locale: string = "en",
  requestId?: string
) {
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.ratingSubmitted.emailSubject",
    subjectParams: { rating: String(rating) },
    headingKey: "notifications.ratingSubmitted.emailBody.heading",
    introKey: "notifications.ratingSubmitted.emailBody.intro",
    introParams: { requestTitle, rating: String(rating) },
    buttonKey: "notifications.ratingSubmitted.emailBody.viewButton",
    href: appUrl(requestId ? `/provider/requests/${requestId}` : "/provider/requests"),
  });
}

export async function getWithdrawalReviewedEmailTemplate(params: {
  status: "APPROVED" | "REJECTED";
  amount: string;
  reason: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  const key = params.status === "APPROVED" ? "withdrawalApproved" : "withdrawalRejected";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: `notifications.${key}.emailSubject`,
    subjectParams: { amount: params.amount },
    headingKey: `notifications.${key}.emailBody.heading`,
    introKey: `notifications.${key}.emailBody.intro`,
    introParams: { amount: params.amount },
    bodyKey: `notifications.${key}.emailBody.reason`,
    bodyParams: { reason: params.reason },
    buttonKey: `notifications.${key}.emailBody.viewButton`,
    href: `${appBaseUrl()}/provider/wallet`,
    calloutVariant: params.status === "APPROVED" ? "success" : "danger",
  });
}

export async function getFinanceDisputeReviewedEmailTemplate(params: {
  status: string;
  note: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.financeDisputeReviewed.emailSubject",
    subjectParams: { status: params.status },
    headingKey: "notifications.financeDisputeReviewed.emailBody.heading",
    introKey: "notifications.financeDisputeReviewed.emailBody.intro",
    introParams: { status: params.status },
    bodyKey: "notifications.financeDisputeReviewed.emailBody.note",
    bodyParams: { note: params.note },
    buttonKey: "notifications.financeDisputeReviewed.emailBody.viewButton",
    href: `${appBaseUrl()}/provider/wallet`,
    calloutVariant: "warning",
  });
}

export async function getRequestUnassignedEmailTemplate(
  requestTitle: string,
  locale: string = "en",
  requestId?: string
) {
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.requestUnassigned.emailSubject",
    subjectParams: { requestTitle },
    headingKey: "notifications.requestUnassigned.emailBody.heading",
    introKey: "notifications.requestUnassigned.emailBody.intro",
    introParams: { requestTitle },
    buttonKey: "notifications.requestUnassigned.emailBody.viewButton",
    href: appUrl(requestId ? `/provider/available/${requestId}` : "/provider/available"),
  });
}

export async function getRequestCancelledEmailTemplate(
  requestTitle: string,
  locale: string = "en",
  role: "PROVIDER" | "CLIENT" = "PROVIDER",
  requestId?: string
) {
  const base = role === "CLIENT" ? "/client/requests" : "/provider/requests";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.requestCancelled.emailSubject",
    subjectParams: { requestTitle },
    headingKey: "notifications.requestCancelled.emailBody.heading",
    introKey: "notifications.requestCancelled.emailBody.intro",
    introParams: { requestTitle },
    buttonKey: "notifications.requestCancelled.emailBody.viewButton",
    href: appUrl(requestId ? `${base}/${requestId}` : base),
    calloutVariant: "warning",
  });
}

export async function getEarningsHoldReleasedEmailTemplate(params: {
  amount: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.earningsHoldReleased.emailSubject",
    subjectParams: { amount: params.amount },
    headingKey: "notifications.earningsHoldReleased.emailBody.heading",
    introKey: "notifications.earningsHoldReleased.emailBody.intro",
    introParams: { amount: params.amount },
    buttonKey: "notifications.earningsHoldReleased.emailBody.viewButton",
    href: `${appBaseUrl()}/provider/wallet`,
    calloutVariant: "success",
  });
}

export async function getAccountDeactivatedEmailTemplate(params: {
  userName: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.accountDeactivated.emailSubject",
    headingKey: "notifications.accountDeactivated.emailBody.heading",
    introKey: "notifications.accountDeactivated.emailBody.intro",
    introParams: { userName: params.userName },
    bodyKey: "notifications.accountDeactivated.emailBody.message",
    buttonKey: "notifications.accountDeactivated.emailBody.viewButton",
    href: appBaseUrl(),
    calloutVariant: "danger",
  });
}

export async function getAccountReactivatedEmailTemplate(params: {
  userName: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.accountReactivated.emailSubject",
    headingKey: "notifications.accountReactivated.emailBody.heading",
    introKey: "notifications.accountReactivated.emailBody.intro",
    introParams: { userName: params.userName },
    buttonKey: "notifications.accountReactivated.emailBody.viewButton",
    href: `${appBaseUrl()}/auth/login`,
    calloutVariant: "success",
  });
}

export async function getRequestCreatedByAdminEmailTemplate(
  requestTitle: string,
  locale: string = "en",
  requestId?: string
) {
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.requestCreatedByAdmin.emailSubject",
    subjectParams: { requestTitle },
    headingKey: "notifications.requestCreatedByAdmin.emailBody.heading",
    introKey: "notifications.requestCreatedByAdmin.emailBody.intro",
    introParams: { requestTitle },
    buttonKey: "notifications.requestCreatedByAdmin.emailBody.viewButton",
    href: appUrl(requestId ? `/client/requests/${requestId}` : "/client/requests"),
  });
}

export async function getRequestRestoredEmailTemplate(
  requestTitle: string,
  locale: string = "en",
  role: "PROVIDER" | "CLIENT" = "PROVIDER",
  requestId?: string
) {
  const base = role === "CLIENT" ? "/client/requests" : "/provider/requests";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.requestRestored.emailSubject",
    subjectParams: { requestTitle },
    headingKey: "notifications.requestRestored.emailBody.heading",
    introKey: "notifications.requestRestored.emailBody.intro",
    introParams: { requestTitle },
    buttonKey: "notifications.requestRestored.emailBody.viewButton",
    href: appUrl(requestId ? `${base}/${requestId}` : base),
    calloutVariant: "success",
  });
}

export async function getAdminWithdrawalRequestedEmailTemplate(params: {
  providerNameOrEmail: string;
  amount: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.withdrawalRequested.emailSubject",
    subjectParams: { amount: params.amount },
    headingKey: "notifications.withdrawalRequested.emailBody.heading",
    introKey: "notifications.withdrawalRequested.emailBody.intro",
    introParams: {
      providerNameOrEmail: params.providerNameOrEmail,
      amount: params.amount,
    },
    buttonKey: "notifications.withdrawalRequested.emailBody.viewButton",
    href: `${appBaseUrl()}/admin/finance`,
    calloutVariant: "warning",
  });
}

export async function getAdminFinanceDisputeOpenedEmailTemplate(params: {
  providerNameOrEmail: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.financeDisputeOpened.emailSubject",
    headingKey: "notifications.financeDisputeOpened.emailBody.heading",
    introKey: "notifications.financeDisputeOpened.emailBody.intro",
    introParams: { providerNameOrEmail: params.providerNameOrEmail },
    buttonKey: "notifications.financeDisputeOpened.emailBody.viewButton",
    href: `${appBaseUrl()}/admin/finance`,
    calloutVariant: "warning",
  });
}

export async function getAdminPaymentVerificationEmailTemplate(params: {
  clientNameOrEmail: string;
  amount: string;
  currency: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.paymentVerification.emailSubject",
    subjectParams: { amount: params.amount, currency: params.currency },
    headingKey: "notifications.paymentVerification.emailBody.heading",
    introKey: "notifications.paymentVerification.emailBody.intro",
    introParams: {
      clientNameOrEmail: params.clientNameOrEmail,
      amount: params.amount,
      currency: params.currency,
    },
    buttonKey: "notifications.paymentVerification.emailBody.viewButton",
    href: `${appBaseUrl()}/admin/payments`,
    calloutVariant: "warning",
  });
}

export async function getPaymentApprovedEmailTemplate(packageName: string, locale: string = "en") {
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.paymentApproved.emailSubject",
    subjectParams: { packageName },
    headingKey: "notifications.paymentApproved.emailBody.heading",
    introKey: "notifications.paymentApproved.emailBody.intro",
    introParams: { packageName },
    buttonKey: "notifications.paymentApproved.emailBody.viewButton",
    href: `${appBaseUrl()}/client/subscription`,
    calloutVariant: "success",
  });
}

export async function getPaymentRejectedEmailTemplate(reason: string, locale: string = "en") {
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.paymentRejected.emailSubject",
    headingKey: "notifications.paymentRejected.emailBody.heading",
    introKey: "notifications.paymentRejected.emailBody.intro",
    bodyKey: "notifications.paymentRejected.emailBody.reason",
    bodyParams: { reason },
    buttonKey: "notifications.paymentRejected.emailBody.viewButton",
    href: `${appBaseUrl()}/client/payment`,
    calloutVariant: "danger",
  });
}

export async function getPaymentProofReceivedEmailTemplate(params: {
  amount: string;
  currency: string;
  packageName: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.paymentProofReceived.emailSubject",
    headingKey: "notifications.paymentProofReceived.emailBody.heading",
    introKey: "notifications.paymentProofReceived.emailBody.intro",
    introParams: {
      amount: params.amount,
      currency: params.currency,
      packageName: params.packageName,
    },
    buttonKey: "notifications.paymentProofReceived.emailBody.viewButton",
    href: `${appBaseUrl()}/client/subscription`,
  });
}

export async function getSubscriptionStartedEmailTemplate(
  packageName: string,
  locale: string = "en"
) {
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.subscriptionStarted.emailSubject",
    subjectParams: { packageName },
    headingKey: "notifications.subscriptionStarted.emailBody.heading",
    introKey: "notifications.subscriptionStarted.emailBody.intro",
    introParams: { packageName },
    bodyKey: "notifications.subscriptionStarted.emailBody.message",
    buttonKey: "notifications.subscriptionStarted.emailBody.viewButton",
    href: `${appBaseUrl()}/client/payment`,
    calloutVariant: "warning",
  });
}

export async function getSubscriptionCancelledEmailTemplate(params: {
  wasActive: boolean;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  const bodyKey = params.wasActive
    ? "notifications.subscriptionCancelled.emailBody.activeMessage"
    : "notifications.subscriptionCancelled.emailBody.pendingMessage";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.subscriptionCancelled.emailSubject",
    headingKey: "notifications.subscriptionCancelled.emailBody.heading",
    introKey: bodyKey,
    buttonKey: "notifications.subscriptionCancelled.emailBody.viewButton",
    href: `${appBaseUrl()}/client/subscription`,
    calloutVariant: "warning",
  });
}

export async function getPasswordChangedEmailTemplate(params: {
  userName: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.passwordChanged.emailSubject",
    headingKey: "notifications.passwordChanged.emailBody.heading",
    introKey: "notifications.passwordChanged.emailBody.intro",
    introParams: { userName: params.userName },
    bodyKey: "notifications.passwordChanged.emailBody.message",
    buttonKey: "notifications.passwordChanged.emailBody.viewButton",
    href: `${appBaseUrl()}/auth/login`,
    calloutVariant: "warning",
  });
}

export async function getEmailChangedEmailTemplate(params: {
  userName: string;
  oldEmail: string;
  newEmail: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.emailChanged.emailSubject",
    headingKey: "notifications.emailChanged.emailBody.heading",
    introKey: "notifications.emailChanged.emailBody.intro",
    introParams: { userName: params.userName },
    bodyKey: "notifications.emailChanged.emailBody.message",
    bodyParams: { oldEmail: params.oldEmail, newEmail: params.newEmail },
    buttonKey: "notifications.emailChanged.emailBody.viewButton",
    href: `${appBaseUrl()}/auth/login`,
    calloutVariant: "warning",
  });
}

export async function getAccountDeletedEmailTemplate(params: {
  userName: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.accountDeleted.emailSubject",
    headingKey: "notifications.accountDeleted.emailBody.heading",
    introKey: "notifications.accountDeleted.emailBody.intro",
    introParams: { userName: params.userName },
    bodyKey: "notifications.accountDeleted.emailBody.message",
    buttonKey: "notifications.accountDeleted.emailBody.viewButton",
    href: appBaseUrl(),
    calloutVariant: "warning",
  });
}

export async function getAdminNewUserRegistrationEmailTemplate(params: {
  userName: string;
  userEmail: string;
  role: string;
  reapplied?: boolean;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  const prefix = params.reapplied
    ? "notifications.newUserRegistration.reapply"
    : "notifications.newUserRegistration";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: `${prefix}.emailSubject`,
    subjectParams: { userName: params.userName, role: params.role },
    headingKey: `${prefix}.emailBody.heading`,
    introKey: `${prefix}.emailBody.intro`,
    introParams: {
      userName: params.userName,
      userEmail: params.userEmail,
      role: params.role,
    },
    buttonKey: `${prefix}.emailBody.viewButton`,
    href: `${appBaseUrl()}/admin/users`,
    calloutVariant: "warning",
  });
}

export async function getAdminContactMessageEmailTemplate(params: {
  fullName: string;
  email: string;
  topic: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.contactMessage.emailSubject",
    subjectParams: { fullName: params.fullName },
    headingKey: "notifications.contactMessage.emailBody.heading",
    introKey: "notifications.contactMessage.emailBody.intro",
    introParams: {
      fullName: params.fullName,
      email: params.email,
      topic: params.topic,
    },
    buttonKey: "notifications.contactMessage.emailBody.viewButton",
    href: `${appBaseUrl()}/admin/contacts`,
    calloutVariant: "warning",
  });
}

export async function getAdminContactLeakRepeatEmailTemplate(params: {
  kinds: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.contactLeakRepeat.emailSubject",
    headingKey: "notifications.contactLeakRepeat.emailBody.heading",
    introKey: "notifications.contactLeakRepeat.emailBody.intro",
    introParams: { kinds: params.kinds },
    buttonKey: "notifications.contactLeakRepeat.emailBody.viewButton",
    href: `${appBaseUrl()}/admin/contact-leaks`,
    calloutVariant: "danger",
  });
}

export async function getAdminManualApprovalNeededEmailTemplate(params: {
  requestTitle: string;
  requestId?: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.manualApprovalNeeded.emailSubject",
    subjectParams: { requestTitle: params.requestTitle },
    headingKey: "notifications.manualApprovalNeeded.emailBody.heading",
    introKey: "notifications.manualApprovalNeeded.emailBody.intro",
    introParams: { requestTitle: params.requestTitle },
    buttonKey: "notifications.manualApprovalNeeded.emailBody.viewButton",
    href: appUrl(params.requestId ? `/admin/requests/${params.requestId}` : "/admin/requests"),
    calloutVariant: "warning",
  });
}

export async function getProviderServicesUpdatedEmailTemplate(params: { locale?: string }) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.providerServicesUpdated.emailSubject",
    headingKey: "notifications.providerServicesUpdated.emailBody.heading",
    introKey: "notifications.providerServicesUpdated.emailBody.intro",
    buttonKey: "notifications.providerServicesUpdated.emailBody.viewButton",
    href: appUrl("/provider/available"),
  });
}

export async function getMaintenanceModeChangedEmailTemplate(params: {
  enabled: boolean;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  const key = params.enabled ? "maintenanceModeEnabled" : "maintenanceModeDisabled";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: `notifications.${key}.emailSubject`,
    headingKey: `notifications.${key}.emailBody.heading`,
    introKey: `notifications.${key}.emailBody.intro`,
    buttonKey: `notifications.${key}.emailBody.viewButton`,
    href: appUrl("/admin/settings"),
    calloutVariant: params.enabled ? "warning" : "success",
  });
}

export async function getRoleChangedEmailTemplate(params: {
  userName: string;
  oldRole: string;
  newRole: string;
  locale?: string;
}) {
  const locale = params.locale ?? "en";
  return buildSimpleCtaEmail({
    locale,
    subjectKey: "notifications.roleChanged.emailSubject",
    subjectParams: { newRole: params.newRole },
    headingKey: "notifications.roleChanged.emailBody.heading",
    introKey: "notifications.roleChanged.emailBody.intro",
    introParams: { userName: params.userName },
    bodyKey: "notifications.roleChanged.emailBody.message",
    bodyParams: { oldRole: params.oldRole, newRole: params.newRole },
    buttonKey: "notifications.roleChanged.emailBody.viewButton",
    href: `${appBaseUrl()}/auth/login`,
    calloutVariant: "warning",
  });
}

/** Ops / internal notify — English layout, no user-facing i18n. */
export async function getOpsNotifyEmailHtml(params: {
  title: string;
  rows: Array<{ label: string; value: string }>;
  messageBody?: string;
}): Promise<string> {
  const messageBlock = params.messageBody
    ? emailPanel(
        `<pre style="margin:0;white-space:pre-wrap;font-family:${FONT};font-size:14px;line-height:1.55;color:${EMAIL_COLORS.ink};">${params.messageBody}</pre>`
      )
    : "";

  return wrapEmailHtml(
    `
      ${emailMetaRows(params.rows)}
      ${messageBlock}
    `,
    { locale: "en", title: params.title, hideFooter: true }
  );
}
