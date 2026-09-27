import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { logActivityAsync } from "@/lib/activity-log";
import { notifyAdminsContactMessage } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const CONTACT_RATE_LIMIT = { limit: 5, windowMs: 60_000 };

const BodySchema = z.object({
  type: z.enum(["client", "provider", "general"]).default("general"),
  topic: z.string().max(64).optional().default(""),
  fullName: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().min(1).max(40),
  company: z.string().max(200).optional().default(""),
  website: z.string().max(500).optional().default(""),
  message: z.string().min(1).max(5000),
  serviceLabels: z.string().max(2000).optional().default(""),
});

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

    const json = await req.json();
    const body = BodySchema.parse(json);

    const row = await db.contactMessage.create({
      data: {
        type: body.type,
        topic: body.topic.trim() || null,
        fullName: body.fullName.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone.trim(),
        company: body.company.trim(),
        website: body.website.trim(),
        message: body.message.trim(),
        serviceLabels: body.serviceLabels.trim(),
        ip: ip === "unknown" ? null : ip,
      },
    });

    logActivityAsync({
      action: "contact.submit",
      message: `Contact message from ${row.email}`,
      entityType: "ContactMessage",
      entityId: row.id,
      ip: row.ip,
      metadata: {
        type: row.type,
        topic: row.topic,
        email: row.email,
      },
    });

    void notifyAdminsContactMessage({
      fullName: row.fullName,
      email: row.email,
      topic: row.topic,
      messageId: row.id,
    }).catch((err) => {
      logger.error("Failed to notify admins of contact message", {
        error: err instanceof Error ? err : undefined,
        messageId: row.id,
      });
    });

    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    logger.error("Contact form submit failed", {
      error: err instanceof Error ? err : undefined,
    });
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
