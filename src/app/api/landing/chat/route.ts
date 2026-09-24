import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Public AI chat — expensive per call, so keep this tight.
const CHAT_RATE_LIMIT = { limit: 10, windowMs: 60_000 };

const BodySchema = z.object({
  prompt: z.string().min(1),
  locale: z.enum(["en", "ar"]).optional().default("en"),
});

const KNOWLEDGE_FILES = [
  "docs/WENGZ_KNOWLEDGE.md",
  "docs/WENGZ_INTENT_PLAYBOOKS.md",
] as const;

async function loadKnowledgeBase() {
  try {
    const parts: string[] = [];
    for (const rel of KNOWLEDGE_FILES) {
      const filePath = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
      try {
        const content = await readFile(filePath, "utf8");
        if (content.trim()) parts.push(content.trim());
      } catch {
        /* optional file */
      }
    }
    return parts.join("\n\n---\n\n");
  } catch {
    return "";
  }
}

/** Infer reply language from the user's prompt; fall back to the page locale. */
function detectPromptLocale(prompt: string, pageLocale: "en" | "ar"): "en" | "ar" {
  const arabicRe = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const latinRe = /[a-zA-Z]/g;
  const arabicCount = prompt.match(arabicRe)?.length ?? 0;
  const latinCount = prompt.match(latinRe)?.length ?? 0;
  if (arabicCount === 0 && latinCount === 0) return pageLocale;
  if (arabicCount > 0 && latinCount === 0) return "ar";
  if (latinCount > 0 && arabicCount === 0) return "en";
  return arabicCount >= latinCount ? "ar" : "en";
}

function registerPageUrl(origin: string, locale: "en" | "ar") {
  return `${origin}/${locale}/auth/register`;
}

function providerFormUrl(origin: string, locale: "en" | "ar") {
  return `${origin}/${locale}/forms/provider`;
}

function getPublicOrigin(req: Request) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;

  if (configuredOrigin?.startsWith("http")) {
    return new URL(configuredOrigin).origin;
  }

  return new URL(req.url).origin;
}

function buildSystemPrompt(locale: "en" | "ar", knowledgeBase: string, origin: string) {
  const registerUrl = registerPageUrl(origin, locale);
  const providerUrl = providerFormUrl(origin, locale);

  const languageRule =
    locale === "ar"
      ? "Write the entire response in Arabic (Egyptian casual marketing tone is fine when it fits the playbooks)."
      : "Write the entire response in English.";

  const playbookIntentRule = [
    "Intent playbooks (in knowledge base, section 'Intent playbooks'): When the user's message clearly matches one of the listed intents—or a close paraphrase—follow that playbook's tone, pacing, questions, and line breaks.",
    locale === "ar"
      ? "For Arabic, mirror the Egyptian casual voice of the Arabic playbook (same energy; do not translate into formal Modern Standard Arabic unless the user writes formally)."
      : "For English, mirror the English playbook voice (direct, warm, marketing-casual).",
    "When a playbook applies: do NOT use the mandatory fixed opening line from the default format below. Still end with at least one markdown link to registration.",
    "Never output the literal placeholder [LINK]; replace it with a markdown link using an inviting label in the response language.",
    `All registration links MUST use this exact locale prefix: /${locale}/auth/register — use markdown: [label](${registerUrl}) for the main CTA. Add [label](${providerUrl}) when the user is clearly asking about joining as a provider.`,
    "If no playbook fits, use the default response format rules below.",
  ].join(" ");

  const styleRule =
    locale === "ar"
      ? [
          "Response format is mandatory:",
          '1) Start with exactly this opening line: "أنا وينجز، وأقدر أساعدك بطريقة حديثة واحترافية."',
          "2) Immediately add a short numbered line of what you can provide in this request (1, 2, 3).",
          "3) Then provide a practical direct answer to the user request.",
          "4) Never use refusal phrasing like 'لا أستطيع' or 'لا يمكنني المساعدة' for normal business/creative requests.",
          "5) If details are incomplete, ask the user to register/login and submit full request details so the team can serve accurately.",
          `3) End with a registration CTA line that includes a markdown link: [للتجربة والتسجيل](${registerUrl}).`,
          `4) If the user asks about becoming a provider, also include a markdown link: [تسجيل المبدعين](${providerUrl}).`,
          "5) CTA tone should feel energetic and inviting (example: let's try me now).",
        ].join(" ")
      : [
          "Response format is mandatory:",
          '1) Start with exactly this opening line: "I am Wengz. I can handle this for you in a modern, professional way."',
          "2) Immediately add a short numbered line of what you can provide in this request (1, 2, 3).",
          "3) Then provide a practical direct answer to the user request.",
          "4) Never use refusal phrasing like 'I can't assist' for normal business/creative requests.",
          "5) If details are incomplete, ask the user to register/login and submit full request details so the team can serve accurately.",
          `3) End with a registration CTA line that includes a markdown link: [Let's register and try me](${registerUrl}).`,
          `4) If the user asks about becoming a provider, also include a markdown link: [Provider registration](${providerUrl}).`,
          "5) CTA tone should feel energetic and inviting (example: let's try me now).",
        ].join(" ");

  const knowledge = knowledgeBase
    ? knowledgeBase.slice(0, 60000)
    : "No knowledge file was provided.";

  const servicesFaqRule = [
    "Services scope (canonical): Wengz is not 'just an AI tool' — it combines smart tooling with human expertise; you work together to deliver what the client needs.",
    "When the user asks what services you offer or what Wengz does, reflect: professional design, social media content, video and ads, account management, paid campaigns, and digital solutions for business growth.",
    "For Arabic users asking this, you may align closely with the Egyptian Arabic phrasing in the knowledge base section 'Canonical Q&A — What services does Wengz offer?'.",
  ].join(" ");

  return [
    "You are Wengz an AI assistant.",
    "Keep answers concise, clear, and practical.",
    "Do not invent unavailable company details. If details are missing, ask for registration/login and full request details instead of refusal-style wording.",
    servicesFaqRule,
    languageRule,
    playbookIntentRule,
    "Default format (only when no intent playbook applies):",
    styleRule,
    "Use the following knowledge base as the primary source of truth:",
    knowledge,
  ].join("\n\n");
}

function ensureFormLinks(reply: string, origin: string, locale: "en" | "ar") {
  const registerUrl = registerPageUrl(origin, locale);
  const providerUrl = providerFormUrl(origin, locale);
  const registerText = locale === "ar" ? "للتجربة والتسجيل" : "Let's register and try me";
  const providerText = locale === "ar" ? "تسجيل المبدعين" : "Provider registration";

  const registerMd = `[${registerText}](${registerUrl})`;
  const providerMd = `[${providerText}](${providerUrl})`;

  function rewriteHref(hrefRaw: string): string | null {
    const h = hrefRaw.trim();
    let pathname: string;
    try {
      const u = h.startsWith("/") ? new URL(h, origin) : new URL(h);
      pathname = u.pathname.replace(/\/+$/, "") || "/";
    } catch {
      return null;
    }
    // Legacy client-form links → registration
    if (
      pathname === "/forms/client" ||
      pathname === "/en/forms/client" ||
      pathname === "/ar/forms/client" ||
      pathname === "/auth/register" ||
      pathname === "/en/auth/register" ||
      pathname === "/ar/auth/register"
    ) {
      return registerUrl;
    }
    if (
      pathname === "/forms/provider" ||
      pathname === "/en/forms/provider" ||
      pathname === "/ar/forms/provider"
    ) {
      return providerUrl;
    }
    return null;
  }

  let out = reply.replaceAll(/\[([^\]]*)\]\(([^)]+)\)/g, (full, label: string, href: string) => {
    const next = rewriteHref(href);
    return next ? `[${label}](${next})` : full;
  });

  const originEsc = origin.replaceAll(".", String.raw`\.`);
  const bareReplacements: Array<[RegExp, string]> = [
    [/(^|[\s(])\/forms\/client\b/g, `$1${registerMd}`],
    [/(^|[\s(])\/auth\/register\b/g, `$1${registerMd}`],
    [/(^|[\s(])\/forms\/provider\b/g, `$1${providerMd}`],
    [
      new RegExp(String.raw`(^|[\s(])${originEsc}/(?:en|ar)/forms/client\b`, "g"),
      `$1${registerMd}`,
    ],
    [
      new RegExp(String.raw`(^|[\s(])${originEsc}/(?:en|ar)/auth/register\b`, "g"),
      `$1${registerMd}`,
    ],
    [
      new RegExp(String.raw`(^|[\s(])${originEsc}/(?:en|ar)/forms/provider\b`, "g"),
      `$1${providerMd}`,
    ],
    [new RegExp(String.raw`(^|[\s(])${originEsc}/forms/client\b`, "g"), `$1${registerMd}`],
    [new RegExp(String.raw`(^|[\s(])${originEsc}/auth/register\b`, "g"), `$1${registerMd}`],
    [new RegExp(String.raw`(^|[\s(])${originEsc}/forms/provider\b`, "g"), `$1${providerMd}`],
  ];
  for (const [re, replacement] of bareReplacements) {
    out = out.replaceAll(re, replacement);
  }

  return out;
}

function parseTemperature(raw?: string) {
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return 0.3;
  return Math.min(2, Math.max(0, parsed));
}

function parseMaxTokens(raw?: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 420;
  return Math.min(1200, Math.max(80, Math.floor(parsed)));
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`landing-chat:${ip}`, CHAT_RATE_LIMIT);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const json = await req.json();
    const body = BodySchema.parse(json);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    const origin = getPublicOrigin(req);
    const replyLocale = detectPromptLocale(body.prompt, body.locale);
    const knowledgeBase = await loadKnowledgeBase();
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const temperature = parseTemperature(process.env.OPENAI_TEMPERATURE);
    const maxTokens = parseMaxTokens(process.env.OPENAI_MAX_TOKENS);

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(replyLocale, knowledgeBase, origin),
          },
          {
            role: "user",
            content: body.prompt,
          },
        ],
      }),
    });

    if (!openAIResponse.ok) {
      const failure = await openAIResponse.text();
      logger.error("OpenAI chat completion failed:", failure);
      return NextResponse.json({ error: "Failed to generate reply" }, { status: 502 });
    }

    const data = (await openAIResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const rawReply = data.choices?.[0]?.message?.content?.trim();

    if (!rawReply) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }

    const reply = ensureFormLinks(rawReply, origin, replyLocale);

    return NextResponse.json({ reply, replyLocale });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    logger.error("Landing chat route error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
