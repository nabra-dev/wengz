import { BRAND, brandName } from "@/lib/brand";
import { getTranslation } from "./i18n-helper";

/** Wengz purple / yellow — hex only (email clients ignore CSS variables). */
export const EMAIL_COLORS = {
  purple: BRAND.colors.purple,
  yellow: BRAND.colors.yellow,
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  border: "#e2e8f0",
  surface: "#ffffff",
  canvas: "#f1f5f9",
  panel: "#f8fafc",
  warningBg: "#fffbeb",
  warningBorder: "#f59e0b",
  warningText: "#92400e",
  dangerBg: "#fef2f2",
  dangerBorder: "#ef4444",
  dangerText: "#991b1b",
  successBg: "#f0fdf4",
  successBorder: "#22c55e",
  successText: "#166534",
} as const;

export type EmailTone = "default" | "warning" | "danger" | "success";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, Tahoma, sans-serif";

export function appBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://wengz.tech"
  ).replace(/\/$/, "");
}

/** Bare address for mailto / display (strips `Name <email>`). */
export function contactEmailAddress(): string {
  const raw =
    process.env.CONTACT_FORMS_RECIPIENT ||
    process.env.EMAIL_FROM ||
    process.env.EMAIL_USER ||
    "info@wengz.tech";
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim();
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function emailButton(label: string, href: string, tone: EmailTone = "default"): string {
  let bg: string = EMAIL_COLORS.purple;
  let color: string = EMAIL_COLORS.yellow;
  if (tone === "warning") {
    bg = EMAIL_COLORS.warningBorder;
    color = "#ffffff";
  } else if (tone === "danger") {
    bg = EMAIL_COLORS.dangerBorder;
    color = "#ffffff";
  } else if (tone === "success") {
    bg = EMAIL_COLORS.successBorder;
    color = "#ffffff";
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 8px;">
      <tr>
        <td align="center" bgcolor="${bg}" style="border-radius: 10px; background-color: ${bg};">
          <a href="${escapeAttr(href)}"
             style="display: inline-block; padding: 14px 28px; font-family: ${FONT}; font-size: 15px; font-weight: 700; line-height: 1.2; color: ${color}; text-decoration: none; border-radius: 10px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

export function emailPanel(innerHtml: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin: 20px 0; background-color: ${EMAIL_COLORS.panel}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 12px;">
      <tr>
        <td style="padding: 18px 20px; font-family: ${FONT}; font-size: 15px; line-height: 1.6; color: ${EMAIL_COLORS.body};">
          ${innerHtml}
        </td>
      </tr>
    </table>`;
}

export function emailCallout(
  innerHtml: string,
  tone: Exclude<EmailTone, "default"> = "warning"
): string {
  const map = {
    warning: {
      bg: EMAIL_COLORS.warningBg,
      border: EMAIL_COLORS.warningBorder,
      text: EMAIL_COLORS.warningText,
    },
    danger: {
      bg: EMAIL_COLORS.dangerBg,
      border: EMAIL_COLORS.dangerBorder,
      text: EMAIL_COLORS.dangerText,
    },
    success: {
      bg: EMAIL_COLORS.successBg,
      border: EMAIL_COLORS.successBorder,
      text: EMAIL_COLORS.successText,
    },
  } as const;
  const c = map[tone];
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin: 20px 0; background-color: ${c.bg}; border-left: 4px solid ${c.border}; border-radius: 0 12px 12px 0;">
      <tr>
        <td style="padding: 16px 18px; font-family: ${FONT}; font-size: 15px; line-height: 1.6; color: ${c.text};">
          ${innerHtml}
        </td>
      </tr>
    </table>`;
}

export function emailParagraph(html: string, muted = false): string {
  return `<p style="margin: 0 0 14px; font-family: ${FONT}; font-size: 15px; line-height: 1.65; color: ${muted ? EMAIL_COLORS.muted : EMAIL_COLORS.body};">${html}</p>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="margin: 0 0 16px; font-family: ${FONT}; font-size: 22px; font-weight: 700; line-height: 1.3; color: ${EMAIL_COLORS.ink};">${text}</h1>`;
}

export function emailMetaRows(rows: Array<{ label: string; value: string }>): string {
  const cells = rows
    .map(
      (row) => `
      <tr>
        <td style="padding: 6px 0; font-family: ${FONT}; font-size: 13px; color: ${EMAIL_COLORS.muted}; width: 38%; vertical-align: top;">${row.label}</td>
        <td style="padding: 6px 0; font-family: ${FONT}; font-size: 14px; color: ${EMAIL_COLORS.ink}; font-weight: 600; vertical-align: top;">${row.value}</td>
      </tr>`
    )
    .join("");
  return emailPanel(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>`
  );
}

type WrapOptions = {
  locale?: string;
  title?: string;
  preheader?: string;
  /** Hide default shared footer (welcome uses a richer footer). */
  hideFooter?: boolean;
  footerExtraHtml?: string;
};

export async function wrapEmailHtml(bodyHtml: string, options: WrapOptions = {}): Promise<string> {
  const locale = options.locale ?? "en";
  const isRtl = locale === "ar";
  const dir = isRtl ? "rtl" : "ltr";
  const align = isRtl ? "right" : "left";
  const name = brandName(locale);
  const year = String(new Date().getFullYear());
  const base = appBaseUrl();
  const contact = contactEmailAddress();

  const tagline = await getTranslation(locale, "notifications.emailLayout.tagline");
  const copyright = await getTranslation(locale, "notifications.emailLayout.copyright", {
    year,
    brand: name,
  });
  const disclaimer = await getTranslation(locale, "notifications.emailLayout.disclaimer", {
    brand: name,
  });
  const needHelp = await getTranslation(locale, "notifications.emailLayout.needHelp");
  const emailUs = await getTranslation(locale, "notifications.emailLayout.emailUs");
  const visitSite = await getTranslation(locale, "notifications.emailLayout.visitSite");

  const preheader = options.preheader
    ? `<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${options.preheader}</div>`
    : "";

  const titleBlock = options.title ? emailHeading(options.title) : "";

  const siteUrlHtml = `
            <p style="margin: 0 0 8px; font-family: ${FONT}; font-size: 13px; color: ${EMAIL_COLORS.muted};">
              ${visitSite}
              <a href="${escapeAttr(base)}" style="color: ${EMAIL_COLORS.purple}; text-decoration: none; font-weight: 600;">${base}</a>
            </p>`;

  const footer = options.hideFooter
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 8px;">
        <tr>
          <td style="padding: 24px 8px 8px; border-top: 1px solid ${EMAIL_COLORS.border}; text-align: ${align};">
            ${options.footerExtraHtml || ""}
            ${siteUrlHtml}
            <p style="margin: 0 0 4px; font-family: ${FONT}; font-size: 12px; color: ${EMAIL_COLORS.faint};">${copyright}</p>
          </td>
        </tr>
      </table>`
    : `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 8px;">
        <tr>
          <td style="padding: 24px 8px 8px; border-top: 1px solid ${EMAIL_COLORS.border}; text-align: ${align};">
            <p style="margin: 0 0 8px; font-family: ${FONT}; font-size: 13px; color: ${EMAIL_COLORS.muted};">${needHelp}</p>
            <p style="margin: 0 0 8px; font-family: ${FONT}; font-size: 13px; color: ${EMAIL_COLORS.muted};">
              ${emailUs}
              <a href="mailto:${escapeAttr(contact)}" style="color: ${EMAIL_COLORS.purple}; text-decoration: none; font-weight: 600;">${contact}</a>
            </p>
            ${siteUrlHtml}
            ${options.footerExtraHtml || ""}
            <p style="margin: 0 0 4px; font-family: ${FONT}; font-size: 12px; color: ${EMAIL_COLORS.faint};">${copyright}</p>
            <p style="margin: 0; font-family: ${FONT}; font-size: 12px; color: ${EMAIL_COLORS.faint};">${disclaimer}</p>
          </td>
        </tr>
      </table>`;

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${options.title ? escapeAttr(options.title) : name}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.canvas}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${EMAIL_COLORS.canvas};">
    <tr>
      <td align="center" style="padding: 28px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td style="padding: 0 4px 16px; text-align: ${align};">
              <a href="${escapeAttr(base)}" style="text-decoration: none;">
                <span style="font-family: ${FONT}; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: ${EMAIL_COLORS.purple};">${name}</span>
              </a>
              <div style="margin-top: 6px; font-family: ${FONT}; font-size: 12px; color: ${EMAIL_COLORS.muted};">${tagline}</div>
            </td>
          </tr>
          <tr>
            <td style="height: 4px; line-height: 4px; font-size: 0; background: linear-gradient(90deg, ${EMAIL_COLORS.purple} 0%, ${EMAIL_COLORS.purple} 72%, ${EMAIL_COLORS.yellow} 72%, ${EMAIL_COLORS.yellow} 100%); border-radius: 4px 4px 0 0;">&nbsp;</td>
          </tr>
          <tr>
            <td bgcolor="${EMAIL_COLORS.surface}" style="background-color: ${EMAIL_COLORS.surface}; border: 1px solid ${EMAIL_COLORS.border}; border-top: 0; border-radius: 0 0 16px 16px; padding: 28px 28px 24px; text-align: ${align}; direction: ${dir};">
              ${titleBlock}
              ${bodyHtml}
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
