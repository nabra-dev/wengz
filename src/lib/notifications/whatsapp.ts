/**
 * WhatsApp Cloud API integration
 * Minimal sender for template messages, gated by env + user opt-in.
 */

type SendTemplateOptions = {
  languageCode?: string; // default 'en'
  bodyParams?: string[]; // maps to template body parameters in order
};

export function isWhatsAppEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED === "true";
}

export function formatE164(phone?: string | null): string | null {
  if (!phone) return null;
  let s = phone.trim();

  // Replace common formatting characters
  s = s.replaceAll(/[\s\-().]/g, "");

  // Handle international prefix '00'
  if (s.startsWith("00")) {
    s = "+" + s.slice(2);
  }

  // If no leading '+', assume it's an international number and prepend '+'
  if (!s.startsWith("+") && /^\d{7,15}$/.test(s)) {
    s = "+" + s;
  }

  // Final validation: '+' followed by 7-15 digits
  return /^\+\d{7,15}$/.test(s) ? s : null;
}

function parseParamCount(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;
  return fallback;
}

export function getTemplateConfigForType(
  type: string
): { name: string; paramCount: number } | null {
  const fallbackName = process.env.WHATSAPP_TEMPLATE_DEFAULT || "hello_world";
  const map: Record<string, { name?: string; paramCount?: string }> = {
    message: {
      name: process.env.WHATSAPP_TEMPLATE_MESSAGE || fallbackName,
      paramCount: process.env.WHATSAPP_TEMPLATE_MESSAGE_PARAMS,
    },
    status_change: {
      name: process.env.WHATSAPP_TEMPLATE_STATUS_CHANGE || fallbackName,
      paramCount: process.env.WHATSAPP_TEMPLATE_STATUS_CHANGE_PARAMS,
    },
    assignment: {
      name: process.env.WHATSAPP_TEMPLATE_ASSIGNMENT || fallbackName,
      paramCount: process.env.WHATSAPP_TEMPLATE_ASSIGNMENT_PARAMS,
    },
    general: {
      name: process.env.WHATSAPP_TEMPLATE_GENERAL || fallbackName,
      paramCount: process.env.WHATSAPP_TEMPLATE_GENERAL_PARAMS,
    },
  };

  const entry = map[type];
  const name = entry?.name || fallbackName;
  if (!name) return null;

  // Default param count: 0 when using fallback hello_world, else 1 unless overridden
  const defaultCount = name === fallbackName ? 0 : 1;
  const paramCount = parseParamCount(entry?.paramCount, defaultCount);
  return { name, paramCount };
}

export async function sendWhatsAppTemplate(
  toE164: string,
  templateName: string,
  options: SendTemplateOptions = {}
) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const languageCode = options.languageCode || process.env.WHATSAPP_LANGUAGE_CODE || "en_US";

  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp Cloud API not configured: missing access token or phone number ID");
  }

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const components =
    options.bodyParams && options.bodyParams.length > 0
      ? [
          {
            type: "body",
            parameters: options.bodyParams.map((text) => ({ type: "text", text })),
          },
        ]
      : undefined;

  const payload = {
    messaging_product: "whatsapp",
    to: toE164,
    type: "template" as const,
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WhatsApp API error ${res.status}: ${text}`);
  }

  return res.json();
}
