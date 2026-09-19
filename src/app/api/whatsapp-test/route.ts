import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isWhatsAppEnabled,
  formatE164,
  sendWhatsAppTemplate,
  getTemplateConfigForType,
} from "@/lib/notifications/whatsapp";

export async function POST(req: Request) {
  // Test endpoint — development only, must not ship to production.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Allow SUPER_ADMIN, or allow a user to test sending to their own number
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, phone: true, hasWhatsapp: true },
  });

  if (!isWhatsAppEnabled()) {
    return NextResponse.json({ error: "WhatsApp not enabled" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const toRaw: string | undefined = body.to;
  const templateRaw: string | undefined = body.template;
  const type: string | undefined = body.type; // optional: message | status_change | assignment | general
  const languageCode: string | undefined = body.languageCode;
  const params: string[] | undefined = body.params;

  const to = formatE164(toRaw ?? "");
  if (!to) {
    return NextResponse.json({ error: "Invalid E.164 phone in 'to'" }, { status: 400 });
  }

  async function findTargetUser(phoneE164: string) {
    // Try exact match first
    let target = await db.user.findFirst({
      where: { phone: phoneE164 },
      select: { id: true, hasWhatsapp: true, phone: true },
    });
    if (target) return target;

    // Try normalized (remove +)
    const phoneNoPlus = phoneE164.replaceAll(/^\+/g, "");
    target = await db.user.findFirst({
      where: { phone: phoneNoPlus },
      select: { id: true, hasWhatsapp: true, phone: true },
    });
    if (target) return target;

    // Try format match against all opted-in users
    const candidates = await db.user.findMany({
      where: { hasWhatsapp: true, phone: { not: null } },
      select: { id: true, hasWhatsapp: true, phone: true },
      take: 50,
    });
    return candidates.find((c) => formatE164(c.phone) === phoneE164);
  }

  const isAdmin = me?.role === "SUPER_ADMIN";
  const isSelfTest = me?.phone && formatE164(me.phone) === to && me?.hasWhatsapp;
  const target = await findTargetUser(to);
  const isTargetOptedIn = !!target?.hasWhatsapp;

  if (!isAdmin && !isSelfTest && !isTargetOptedIn) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cfg = type ? getTemplateConfigForType(type) : null;
  let templateName = templateRaw ?? cfg?.name;
  if (!templateName) {
    return NextResponse.json(
      { error: "Missing template name (provide 'template' or set env for 'type')" },
      { status: 400 }
    );
  }

  function buildBodyParams() {
    if (!cfg || !params || !Array.isArray(params)) return undefined;
    if (cfg.paramCount === 0) return undefined; // template expects no params
    if (cfg.paramCount > 0 && params.length > cfg.paramCount)
      return params.slice(0, cfg.paramCount);
    return params;
  }

  const bodyParams = buildBodyParams();

  try {
    const res = await sendWhatsAppTemplate(to, templateName, {
      languageCode,
      bodyParams,
    });
    return NextResponse.json({ success: true, apiResponse: res });
  } catch (err: any) {
    const message = err?.message || String(err);
    return NextResponse.json({ error: "WhatsApp send failed", details: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Convenience GET for quick browser checks: /api/whatsapp-test?to=+15551234567&type=general&params=Hello
  const url = new URL(req.url);
  const toRaw = url.searchParams.get("to") || undefined;
  const type = url.searchParams.get("type") || undefined;
  const template = url.searchParams.get("template") || undefined;
  const languageCode = url.searchParams.get("languageCode") || undefined;
  const paramsAll = url.searchParams.getAll("params");

  // Reuse POST handler logic
  return POST(
    new Request(req.url, {
      method: "POST",
      body: JSON.stringify({ to: toRaw, type, template, languageCode, params: paramsAll }),
      headers: { "Content-Type": "application/json" },
    })
  );
}
