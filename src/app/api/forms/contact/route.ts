import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/notifications/email";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Contact form — spam protection.
const CONTACT_RATE_LIMIT = { limit: 5, windowMs: 60_000 };

const BodySchema = z.object({
  type: z.enum(["client", "provider"]),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  company: z.string().optional().default(""),
  website: z.string().optional().default(""),
  message: z.string().optional().default(""),
  serviceLabels: z.string().optional().default(""),
});

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendViaWeb3Forms(payload: {
  subject: string;
  type: "client" | "provider";
  fullName: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  message: string;
}) {
  const accessKey =
    (payload.type === "client"
      ? process.env.WEB3FORMS_CLIENT_ACCESS_KEY
      : process.env.WEB3FORMS_PROVIDER_ACCESS_KEY) || process.env.WEB3FORMS_ACCESS_KEY;
  const normalizedAccessKey = accessKey?.trim();
  if (!normalizedAccessKey) return { attempted: false, ok: false as const };

  const details = [
    `Type: ${payload.type}`,
    `Name: ${payload.fullName}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone}`,
    `Company: ${payload.company || "-"}`,
    `Website: ${payload.website || "-"}`,
    `Message: ${payload.message || "-"}`,
  ].join("\n");

  const res = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_key: normalizedAccessKey,
      subject: payload.subject,
      from_name: "Wengz Website Forms",
      name: payload.fullName,
      email: payload.email,
      replyto: payload.email,
      message: details,
    }),
  });

  if (!res.ok) return { attempted: true, ok: false as const };
  const data = (await res.json()) as { success?: boolean };
  return { attempted: true, ok: Boolean(data.success) };
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`contact-form:${ip}`, CONTACT_RATE_LIMIT);
    if (!rl.success) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    if (
      !process.env.WEB3FORMS_CLIENT_ACCESS_KEY &&
      !process.env.WEB3FORMS_PROVIDER_ACCESS_KEY &&
      !process.env.WEB3FORMS_ACCESS_KEY &&
      (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD)
    ) {
      return NextResponse.json({ ok: false, error: "Email not configured" }, { status: 500 });
    }

    const json = await req.json();
    const body = BodySchema.parse(json);

    const subject =
      body.type === "provider"
        ? `Provider form submission — ${body.fullName}`
        : `Client form submission — ${body.fullName}`;

    const hasMessage = body.message.trim().length > 0;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; line-height: 1.5;">
        <h2 style="margin: 0 0 12px;">New ${escapeHtml(body.type)} submission</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 14px 0;">
          <tr><td style="padding: 6px 0; color: #555; width: 160px;">Name</td><td style="padding: 6px 0;"><strong>${escapeHtml(body.fullName)}</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #555;">Email</td><td style="padding: 6px 0;">${escapeHtml(body.email)}</td></tr>
          <tr><td style="padding: 6px 0; color: #555;">Phone</td><td style="padding: 6px 0;">${escapeHtml(body.phone)}</td></tr>
          <tr><td style="padding: 6px 0; color: #555;">Company</td><td style="padding: 6px 0;">${escapeHtml(body.company || "-")}</td></tr>
          <tr><td style="padding: 6px 0; color: #555;">Website</td><td style="padding: 6px 0;">${escapeHtml(body.website || "-")}</td></tr>
          ${
            body.type === "provider"
              ? `<tr><td style="padding: 6px 0; color: #555;">Services</td><td style="padding: 6px 0;">${escapeHtml(body.serviceLabels || "-")}</td></tr>`
              : ""
          }
        </table>
        <h3 style="margin: 18px 0 8px;">Message</h3>
        <div style="white-space: pre-wrap; background: #f7f7f7; border: 1px solid #eee; border-radius: 8px; padding: 12px;">
          ${hasMessage ? escapeHtml(body.message) : "-"}
        </div>
      </div>
    `;

    const recipient = process.env.CONTACT_FORMS_RECIPIENT || "info@wengz.tech";
    const web3formsResult = await sendViaWeb3Forms({
      subject,
      type: body.type,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      company: body.company,
      website: body.website,
      message: body.message,
    });

    // Keep old SMTP logic as fallback if Web3Forms is unavailable/fails.
    const ok =
      web3formsResult.ok ||
      (await sendEmail({
        to: recipient,
        subject,
        html,
        replyTo: body.email,
      }));

    if (!ok) {
      return NextResponse.json({ ok: false, error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
