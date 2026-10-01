/**
 * Splits plain text into text / URL segments for safe link rendering.
 * Only http(s) and www. URLs are recognized; javascript: and other schemes are ignored.
 */

export type LinkifySegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

/** http(s) or www.… — stops before whitespace; trailing punctuation trimmed below. */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<]+/gi;

const TRAILING_PUNCT_RE = /[.,;:!?)]+$/;

function trimTrailingPunctuation(raw: string): { url: string; trailing: string } {
  const match = raw.match(TRAILING_PUNCT_RE);
  if (!match) return { url: raw, trailing: "" };
  return {
    url: raw.slice(0, -match[0].length),
    trailing: match[0],
  };
}

function toSafeHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Parse text into alternating text and link segments.
 * Non-http(s) matches stay as plain text.
 */
export function linkifyText(text: string): LinkifySegment[] {
  if (!text) return [];

  const segments: LinkifySegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(URL_RE.source, URL_RE.flags);

  for (const match of text.matchAll(re)) {
    const raw = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    const { url, trailing } = trimTrailingPunctuation(raw);
    const href = toSafeHref(url);

    if (href && url) {
      segments.push({ type: "link", value: url, href });
      if (trailing) {
        segments.push({ type: "text", value: trailing });
      }
    } else {
      segments.push({ type: "text", value: raw });
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

export function textContainsUrl(text: string): boolean {
  if (!text) return false;
  URL_RE.lastIndex = 0;
  return URL_RE.test(text);
}
