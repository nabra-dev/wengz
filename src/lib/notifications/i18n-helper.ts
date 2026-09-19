import { logger } from "@/lib/logger";
/**
 * Server-side i18n helper for notifications
 * Loads translations and provides formatting utilities
 */

type Messages = Record<string, any>;

const messagesCache: Record<string, Messages> = {};

/**
 * Load messages for a specific locale
 */
export async function loadMessages(locale: string): Promise<Messages> {
  if (messagesCache[locale]) {
    return messagesCache[locale];
  }

  try {
    const messages = await import(`../../../messages/${locale}.json`);
    messagesCache[locale] = messages.default;
    return messages.default;
  } catch (error) {
    logger.error(`Failed to load messages for locale: ${locale}`, error);
    // Fallback to English
    if (locale !== "en") {
      return loadMessages("en");
    }
    return {};
  }
}

/**
 * Get a translation value by key path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Replace placeholders in a string with provided values
 * Example: formatString("Hello {name}", { name: "John" }) => "Hello John"
 */
export function formatString(template: string, values: Record<string, string | number>): string {
  return template.replaceAll(/\{(\w+)\}/g, (match, key) => {
    return values[key] === undefined ? match : String(values[key]);
  });
}

/**
 * Get a translated message
 * @param locale - The locale to use (e.g., 'en', 'ar')
 * @param key - The key path to the translation (e.g., 'notifications.newMessage.title')
 * @param values - Optional values to replace placeholders
 */
export async function getTranslation(
  locale: string,
  key: string,
  values?: Record<string, string | number>
): Promise<string> {
  const messages = await loadMessages(locale);
  let translation = getNestedValue(messages, key);

  if (!translation) {
    logger.warn(`Translation not found for key: ${key} in locale: ${locale}`);
    // Try fallback to English
    if (locale !== "en") {
      const enMessages = await loadMessages("en");
      translation = getNestedValue(enMessages, key);
    }
  }

  if (typeof translation !== "string") {
    return key;
  }

  if (values) {
    return formatString(translation, values);
  }

  return translation;
}

/**
 * Human-readable estimated delivery duration for system messages (minutes / hours / days),
 * fully localized (no English unit words in Arabic UI).
 */
export async function formatEstimatedDeliveryDuration(
  locale: string,
  estimatedMinutes: number
): Promise<string> {
  const base = "requests.messages.duration";

  if (estimatedMinutes < 60) {
    const key = estimatedMinutes === 1 ? `${base}.minutesOne` : `${base}.minutesOther`;
    return getTranslation(locale, key, { count: estimatedMinutes });
  }

  if (estimatedMinutes < 1440) {
    const hours = Number((estimatedMinutes / 60).toFixed(1));
    const key = hours === 1 ? `${base}.hoursOne` : `${base}.hoursOther`;
    return getTranslation(locale, key, { count: hours });
  }

  const days = Number((estimatedMinutes / 1440).toFixed(1));
  const key = days === 1 ? `${base}.daysOne` : `${base}.daysOther`;
  return getTranslation(locale, key, { count: days });
}

/**
 * Get the user's preferred locale from the database or default to 'en'
 * We can extend the User model to include a preferredLanguage field in the future.
 * For now, we default to 'en' but the function accepts locale as a parameter.
 */
// Reserved for future: fetch user's preferred language from DB
// export async function getUserLocale(userId?: string | null): Promise<string> { /* ... */ }

/**
 * Get locale from cookie string
 */
export function getLocaleFromCookie(cookies?: string): string {
  if (!cookies) {
    return "en";
  }

  const regex = /NEXT_LOCALE=([^;]+)/;
  const match = regex.exec(cookies);
  const locale = match ? match[1] : "en";

  return ["en", "ar"].includes(locale) ? locale : "en";
}
