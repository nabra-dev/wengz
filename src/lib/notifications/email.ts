import nodemailer from "nodemailer";
import { getTranslation } from "./i18n-helper";
import { logger } from "@/lib/logger";

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

  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${heading}</h2>
        <p>${intro}</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;">${messagePreview}</p>
        </div>
        <p><a href="${process.env.NEXTAUTH_URL}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">${viewButton}</a></p>
      </div>
    `,
  };
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

  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${heading}</h2>
        <p>${intro}</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>${fromLabel}</strong> ${oldStatus.replaceAll("_", " ")}</p>
          <p style="margin: 10px 0 0;"><strong>${toLabel}</strong> ${newStatus.replaceAll("_", " ")}</p>
        </div>
        <p><a href="${process.env.NEXTAUTH_URL}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">${viewButton}</a></p>
      </div>
    `,
  };
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

  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${heading}</h2>
        <p>${intro}</p>
        <p><a href="${process.env.NEXTAUTH_URL}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">${viewButton}</a></p>
      </div>
    `,
  };
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

  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${heading}</h2>
        <p>${intro}</p>
        <p>${body}</p>
        <p><a href="${process.env.NEXTAUTH_URL}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">${viewButton}</a></p>
      </div>
    `,
  };
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

  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff9800;">${heading}</h2>
        <p>${intro}</p>
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>${remainingCreditsLabel}</strong> ${remainingCredits}</p>
          <p style="margin: 10px 0 0;"><strong>${expiryDateLabel}</strong> ${expiryDateValue}</p>
        </div>
        <p>${message}</p>
        <p><a href="${process.env.NEXTAUTH_URL}/client/subscription" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">${renewButton}</a></p>
      </div>
    `,
  };
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

  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">${heading}</h2>
        <p>${intro}</p>
        <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;">${message}</p>
          <p style="margin: 10px 0 0;">${message2}</p>
        </div>
        <p><a href="${process.env.NEXTAUTH_URL}/client/subscription" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">${renewButton}</a></p>
      </div>
    `,
  };
}

export async function getWelcomeEmailTemplate(
  userName: string,
  userRole: string,
  locale: string = "en"
) {
  let dashboardLink: string;
  if (userRole === "CLIENT") {
    dashboardLink = `${process.env.NEXTAUTH_URL}/client`;
  } else if (userRole === "PROVIDER") {
    dashboardLink = `${process.env.NEXTAUTH_URL}/provider`;
  } else {
    dashboardLink = `${process.env.NEXTAUTH_URL}/admin`;
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

  let quickStartGuide: string;
  if (userRole === "CLIENT") {
    const step1Title = await getTranslation(
      locale,
      "notifications.welcome.emailBody.client.step1Title"
    );
    const step1Desc = await getTranslation(
      locale,
      "notifications.welcome.emailBody.client.step1Desc"
    );
    const step2Title = await getTranslation(
      locale,
      "notifications.welcome.emailBody.client.step2Title"
    );
    const step2Desc = await getTranslation(
      locale,
      "notifications.welcome.emailBody.client.step2Desc"
    );
    const step3Title = await getTranslation(
      locale,
      "notifications.welcome.emailBody.client.step3Title"
    );
    const step3Desc = await getTranslation(
      locale,
      "notifications.welcome.emailBody.client.step3Desc"
    );
    quickStartGuide = `
          <div style="margin-bottom: 15px;">
            <strong style="color: #2563eb;">${step1Title}</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">${step1Desc}</p>
          </div>
          <div style="margin-bottom: 15px;">
            <strong style="color: #2563eb;">${step2Title}</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">${step2Desc}</p>
          </div>
          <div style="margin-bottom: 15px;">
            <strong style="color: #2563eb;">${step3Title}</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">${step3Desc}</p>
          </div>
          `;
  } else if (userRole === "PROVIDER") {
    const step1Title = await getTranslation(
      locale,
      "notifications.welcome.emailBody.provider.step1Title"
    );
    const step1Desc = await getTranslation(
      locale,
      "notifications.welcome.emailBody.provider.step1Desc"
    );
    const step2Title = await getTranslation(
      locale,
      "notifications.welcome.emailBody.provider.step2Title"
    );
    const step2Desc = await getTranslation(
      locale,
      "notifications.welcome.emailBody.provider.step2Desc"
    );
    const step3Title = await getTranslation(
      locale,
      "notifications.welcome.emailBody.provider.step3Title"
    );
    const step3Desc = await getTranslation(
      locale,
      "notifications.welcome.emailBody.provider.step3Desc"
    );
    quickStartGuide = `
          <div style="margin-bottom: 15px;">
            <strong style="color: #2563eb;">${step1Title}</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">${step1Desc}</p>
          </div>
          <div style="margin-bottom: 15px;">
            <strong style="color: #2563eb;">${step2Title}</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">${step2Desc}</p>
          </div>
          <div style="margin-bottom: 15px;">
            <strong style="color: #2563eb;">${step3Title}</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">${step3Desc}</p>
          </div>
          `;
  } else {
    const step1Title = await getTranslation(
      locale,
      "notifications.welcome.emailBody.admin.step1Title"
    );
    const step1Desc = await getTranslation(
      locale,
      "notifications.welcome.emailBody.admin.step1Desc"
    );
    const step2Title = await getTranslation(
      locale,
      "notifications.welcome.emailBody.admin.step2Title"
    );
    const step2Desc = await getTranslation(
      locale,
      "notifications.welcome.emailBody.admin.step2Desc"
    );
    const step3Title = await getTranslation(
      locale,
      "notifications.welcome.emailBody.admin.step3Title"
    );
    const step3Desc = await getTranslation(
      locale,
      "notifications.welcome.emailBody.admin.step3Desc"
    );
    quickStartGuide = `
          <div style="margin-bottom: 15px;">
            <strong style="color: #2563eb;">${step1Title}</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">${step1Desc}</p>
          </div>
          <div style="margin-bottom: 15px;">
            <strong style="color: #2563eb;">${step2Title}</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">${step2Desc}</p>
          </div>
          <div style="margin-bottom: 15px;">
            <strong style="color: #2563eb;">${step3Title}</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">${step3Desc}</p>
          </div>
          `;
  }

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
  const copyright = await getTranslation(locale, "notifications.welcome.emailBody.copyright", {
    year: new Date().getFullYear().toString(),
  });
  const disclaimer = await getTranslation(locale, "notifications.welcome.emailBody.disclaimer");

  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">${heading}</h1>
          <p style="color: #64748b; margin-top: 10px;">${subheading}</p>
        </div>

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h2 style="margin: 0 0 10px 0;">${greeting}</h2>
          <p style="margin: 0; font-size: 16px; line-height: 1.6;">${intro}</p>
        </div>

        <div style="background: #f8fafc; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
          <h3 style="color: #1e293b; margin-top: 0;">${quickStartTitle}</h3>
          
          ${quickStartGuide}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardLink}" style="background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">${dashboardButton}</a>
        </div>

        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 5px;">
          <p style="margin: 0; color: #92400e;"><strong>${proTip}</strong> ${proTipMessage}</p>
        </div>

        <div style="border-top: 2px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
          <p style="color: #64748b; font-size: 14px; margin-bottom: 10px;">${needHelp}</p>
          <p style="color: #64748b; font-size: 14px; margin: 5px 0;">
            ${emailUs} <a href="mailto:${process.env.EMAIL_FROM}" style="color: #2563eb;">${process.env.EMAIL_FROM}</a>
          </p>
          <p style="color: #64748b; font-size: 14px; margin: 5px 0;">
            ${contactSupport}
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 5px 0;">
            ${copyright}
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin: 5px 0;">
            ${disclaimer}
          </p>
        </div>
      </div>
    `,
  };
}
