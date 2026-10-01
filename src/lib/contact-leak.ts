/**
 * Detects off-platform contact sharing used to pull users out of Wengz
 * (WhatsApp/Telegram/LinkedIn/etc. links, phones, emails, handles, solicitations).
 *
 * Modes:
 * - `strict` — messages, titles, descriptions (block phones/emails too)
 * - `brief` — Q&A attribute answers (allow bare phones/emails for design copy;
 *   still block chat-app links and “contact me on WhatsApp” style text)
 *
 * Client-safe: no server-only imports. Enforcement lives in `contact-leak-enforce.ts`.
 */

export type ContactLeakKind =
  | "messaging_url"
  | "social_url"
  | "email"
  | "phone"
  | "handle"
  | "solicitation";

export type ContactLeakHit = {
  kind: ContactLeakKind;
  match: string;
};

export type ContactLeakMode = "strict" | "brief";

/** Hosts / URL patterns that are clearly for off-platform contact. */
const MESSAGING_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|telegram\.dog|signal\.me|skype\.com|join\.skype\.com|m\.me|messenger\.com|line\.me|viber\.com|discord\.gg|discord\.com\/invite)(?:\/[^\s]*)?/gi;

const SOCIAL_CONTACT_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/(?:in|company|pub)\/[^\s]+|instagram\.com\/[^\s/?#]+|fb\.me\/[^\s]+|facebook\.com\/(?:profile\.php\?[^\s]+|messages\/[^\s]+|[A-Za-z0-9._-]+)\/?(?:[?#][^\s]*)?|snapchat\.com\/add\/[^\s]+|tiktok\.com\/@[^\s]+|x\.com\/[A-Za-z0-9_]+|twitter\.com\/(?:messages|i\/|DM_?[^\s]*|[A-Za-z0-9_]+))/gi;

const EMAIL_RE =
  /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;

/**
 * International / regional phones: +20 1xx…, (02) xxx, spaced/dashed digit runs.
 * Requires enough digits to avoid matching credit costs like "500".
 */
const PHONE_RE = /(?:(?:\+|00)\d{1,4}[\s.-]*)?(?:\(?\d{2,4}\)?[\s.-]*)?\d(?:[\s.-]*\d){6,14}\d/g;

/** Platform-tagged handles (“linkedin: jane”, “instagram @brand”), or “add/dm me @user”. */
const HANDLE_RE =
  /(?:(?:linkedin|instagram|insta|tiktok|twitter|telegram|whatsapp|snap)\s*[:\-–]\s*@?[A-Za-z0-9._]{3,40})|(?:(?:linkedin|instagram|insta|tiktok|twitter|telegram|whatsapp|snap)\s+@[A-Za-z0-9._]{3,40})|(?:(?:add|follow|find|dm|contact|message)\s+(?:me\s+)?@[A-Za-z0-9._]{3,30})\b/gi;

/**
 * Explicit solicitations in EN + AR.
 * Avoid bare brand names alone ("Instagram post design" must stay allowed).
 */
const SOLICITATION_RE =
  /(?:\b(?:contact|reach|message|msg|dm|call|text|add|find)\s+(?:me|us)\s+(?:on|at|via)\b)|(?:\b(?:my|our)\s+(?:whats?\s*app|whatsapp|telegram|signal|skype|viber|discord|linkedin|instagram|insta|snapchat|snap)\b)|(?:\b(?:whats?\s*app|whatsapp|telegram|signal|skype|viber)\s*(?:me|us|number|num|chat|dm)\b)|(?:\bchat\s+(?:on|via)\s+(?:whats?\s*app|whatsapp|telegram)\b)|(?:تواصل(?:ي|وا)?\s*(?:معي|معنا|على)|كلمني|راسلني|ضيفني|تواصل\s*خارج)|(?:رقمي|رقمى|رقم\s*(?:ال)?واتس)|(?:واتس(?:اب)?\s*(?:معي|رقم)|تليجرام\s*(?:معي|رقم)|انستا\s*حسابي)/gi;

const CONTACT_URL_HOST_HINTS = [
  "wa.me",
  "whatsapp.com",
  "t.me",
  "telegram.me",
  "telegram.dog",
  "signal.me",
  "skype.com",
  "m.me",
  "messenger.com",
  "line.me",
  "viber.com",
  "discord.gg",
  "discord.com/invite",
  "linkedin.com/in",
  "linkedin.com/company",
  "instagram.com/",
  "fb.me",
  "facebook.com/messages",
  "snapchat.com/add",
  "tiktok.com/@",
];

export const CONTACT_LEAK_ERROR_MESSAGE =
  "Sharing phone numbers, emails, or off-platform contact links (WhatsApp, Telegram, LinkedIn, etc.) is not allowed. Please keep all communication on Wengz.";

export const CONTACT_LEAK_RATE_LIMIT_MESSAGE =
  "Too many attempts to share off-platform contact details. Please wait before trying again, and keep communication on Wengz.";

/** How many blocked contact-leak attempts before temporary lockout. */
export const CONTACT_LEAK_RATE_LIMIT = { limit: 5, windowMs: 15 * 60_000 } as const;

function pushUnique(hits: ContactLeakHit[], kind: ContactLeakKind, match: string) {
  const normalized = match.trim();
  if (!normalized) return;
  if (hits.some((h) => h.kind === kind && h.match === normalized)) return;
  hits.push({ kind, match: normalized.slice(0, 80) });
}

function collectMatches(text: string, re: RegExp, kind: ContactLeakKind, hits: ContactLeakHit[]) {
  const local = new RegExp(re.source, re.flags);
  for (const match of text.matchAll(local)) {
    pushUnique(hits, kind, match[0]);
  }
}

function digitCount(value: string): number {
  return (value.match(/\d/g) || []).length;
}

function isPlausiblePhone(match: string, fullText: string): boolean {
  const digits = digitCount(match);
  if (digits < 8 || digits > 15) return false;

  const idx = fullText.indexOf(match);
  if (idx >= 0) {
    const around = fullText.slice(Math.max(0, idx - 24), idx + match.length + 24).toLowerCase();
    if (
      /\b(credit|credits|كريدت|price|usd|\$|egp|sar|aed|minute|minutes|revision|revisions)\b/.test(
        around
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Scan free text for off-platform contact patterns.
 */
export function findContactLeaks(text: string, mode: ContactLeakMode = "strict"): ContactLeakHit[] {
  if (!text || !text.trim()) return [];

  const hits: ContactLeakHit[] = [];

  collectMatches(text, MESSAGING_URL_RE, "messaging_url", hits);
  collectMatches(text, SOCIAL_CONTACT_URL_RE, "social_url", hits);
  collectMatches(text, SOLICITATION_RE, "solicitation", hits);
  collectMatches(text, HANDLE_RE, "handle", hits);

  if (mode === "strict") {
    collectMatches(text, EMAIL_RE, "email", hits);

    const phoneRe = new RegExp(PHONE_RE.source, PHONE_RE.flags);
    for (const match of text.matchAll(phoneRe)) {
      if (isPlausiblePhone(match[0], text)) {
        pushUnique(hits, "phone", match[0]);
      }
    }
  }

  return hits;
}

export function textHasContactLeak(text: string, mode: ContactLeakMode = "strict"): boolean {
  return findContactLeaks(text, mode).length > 0;
}

/** True when a URL should not be auto-linked (contact/scam off-platform destinations). */
export function isOffPlatformContactUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  if (!lower) return false;
  return CONTACT_URL_HOST_HINTS.some((hint) => lower.includes(hint));
}

export type ContactLeakScanInput = {
  title?: string;
  description?: string;
  message?: string;
  /** Attribute / Q&A free-text answers (brief mode). */
  attributeAnswers?: string[];
};

/**
 * Scan multiple fields. Title/description/message use strict mode;
 * attribute answers use brief mode.
 */
export function findContactLeaksInFields(input: ContactLeakScanInput): ContactLeakHit[] {
  const hits: ContactLeakHit[] = [];
  const merge = (next: ContactLeakHit[]) => {
    for (const hit of next) pushUnique(hits, hit.kind, hit.match);
  };

  if (input.title) merge(findContactLeaks(input.title, "strict"));
  if (input.description) merge(findContactLeaks(input.description, "strict"));
  if (input.message) merge(findContactLeaks(input.message, "strict"));
  for (const answer of input.attributeAnswers || []) {
    merge(findContactLeaks(answer, "brief"));
  }

  return hits;
}

export function collectAttributeTextAnswers(attributeResponses: unknown): string[] {
  if (!Array.isArray(attributeResponses)) return [];
  const out: string[] = [];
  for (const row of attributeResponses) {
    if (!row || typeof row !== "object") continue;
    const answer = (row as { answer?: unknown }).answer;
    if (typeof answer === "string" && answer.trim()) {
      out.push(answer);
    } else if (Array.isArray(answer)) {
      for (const part of answer) {
        if (typeof part === "string" && part.trim() && !part.includes("/api/files/")) {
          out.push(part);
        }
      }
    }
  }
  return out;
}

/** Safe metadata for activity logs — kinds only, no raw PII payloads. */
export function summarizeContactLeakHits(hits: ContactLeakHit[]): {
  kinds: ContactLeakKind[];
  hitCount: number;
} {
  const kinds = [...new Set(hits.map((h) => h.kind))];
  return { kinds, hitCount: hits.length };
}
