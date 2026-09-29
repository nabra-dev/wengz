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
  locale: string = "en"
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
      ${emailButton(viewButton, appBaseUrl())}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getStatusChangeEmailTemplate(
  requestTitle: string,
  oldStatus: string,
  newStatus: string,
  locale: string = "en"
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
      ${emailButton(viewButton, appBaseUrl())}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getAssignmentEmailTemplate(
  requestTitle: string,
  _providerName: string,
  locale: string = "en"
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
      ${emailButton(viewButton, appBaseUrl())}
    `,
    { locale, title: heading, preheader: subject }
  );

  return { subject, html };
}

export async function getApprovalReminderEmailTemplate(
  requestTitle: string,
  locale: string = "en"
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
      ${emailButton(viewButton, appBaseUrl(), "warning")}
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
