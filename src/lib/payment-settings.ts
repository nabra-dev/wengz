import type { Prisma } from "@prisma/client";

export const PAYMENT_INSTRUCTIONS_KEY = "payment_instructions";

export type ManualPaymentSettings = {
  bankName: string;
  accountName: string;
  iban: string;
  swiftCode: string;
  currency: string;
  note: string;
  instapayEnabled: boolean;
  instapayLink: string;
};

export type PaymentMethodId =
  | "bank_transfer"
  | "instapay"
  | "fawry"
  | "meeza"
  | "visa"
  | "mastercard";

export type PaymentMethodCategory = "manual" | "local" | "international";

export type PaymentMethodDefinition = {
  id: PaymentMethodId;
  category: PaymentMethodCategory;
  /** Hard-gated coming-soon methods never become active from admin alone. */
  comingSoon: boolean;
};

/** Catalog shown on the client payment page. */
export const PAYMENT_METHOD_CATALOG: readonly PaymentMethodDefinition[] = [
  { id: "bank_transfer", category: "manual", comingSoon: false },
  { id: "instapay", category: "local", comingSoon: false },
  { id: "fawry", category: "local", comingSoon: true },
  { id: "meeza", category: "local", comingSoon: true },
  { id: "visa", category: "international", comingSoon: true },
  { id: "mastercard", category: "international", comingSoon: true },
] as const;

export const DEFAULT_PAYMENT_SETTINGS: ManualPaymentSettings = {
  bankName: "National Bank of Kuwait",
  accountName: "NABRA E BUSINESS SOLUTIONS",
  iban: "EG490023002302302617611610010",
  swiftCode: "WABAEGCXXXX",
  currency: "USD",
  note: "Please include your email address in the transfer reference for faster verification.",
  instapayEnabled: true,
  instapayLink: "https://ipn.eg/S/alaa.elsayed6355/instapay/0ee8nl",
};

type SettingsClient = {
  systemSettings: {
    findUnique: (args: {
      where: { key: string };
      select: { value: true };
    }) => Promise<{ value: Prisma.JsonValue } | null>;
  };
};

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function asOptionalString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function parsePaymentSettings(value: Prisma.JsonValue | null | undefined): ManualPaymentSettings {
  const record = asRecord(value);
  if (!record) {
    return { ...DEFAULT_PAYMENT_SETTINGS };
  }

  return {
    bankName: asString(record.bankName, DEFAULT_PAYMENT_SETTINGS.bankName),
    accountName: asString(record.accountName, DEFAULT_PAYMENT_SETTINGS.accountName),
    iban: asString(record.iban, DEFAULT_PAYMENT_SETTINGS.iban),
    swiftCode: asString(record.swiftCode, DEFAULT_PAYMENT_SETTINGS.swiftCode),
    currency: asString(record.currency, DEFAULT_PAYMENT_SETTINGS.currency),
    note: asString(record.note, DEFAULT_PAYMENT_SETTINGS.note),
    instapayEnabled:
      typeof record.instapayEnabled === "boolean"
        ? record.instapayEnabled
        : DEFAULT_PAYMENT_SETTINGS.instapayEnabled,
    instapayLink: asOptionalString(record.instapayLink) || DEFAULT_PAYMENT_SETTINGS.instapayLink,
  };
}

export async function getPaymentSettings(db: SettingsClient): Promise<ManualPaymentSettings> {
  const row = await db.systemSettings.findUnique({
    where: { key: PAYMENT_INSTRUCTIONS_KEY },
    select: { value: true },
  });
  return parsePaymentSettings(row?.value);
}

export type ClientPaymentMethod = {
  id: PaymentMethodId;
  category: PaymentMethodCategory;
  available: boolean;
  comingSoon: boolean;
};

export function buildClientPaymentMethods(settings: ManualPaymentSettings): ClientPaymentMethod[] {
  return PAYMENT_METHOD_CATALOG.map((method) => {
    if (method.comingSoon) {
      return {
        id: method.id,
        category: method.category,
        available: false,
        comingSoon: true,
      };
    }

    if (method.id === "instapay") {
      const available = settings.instapayEnabled && settings.instapayLink.length > 0;
      return {
        id: method.id,
        category: method.category,
        available,
        comingSoon: false,
      };
    }

    return {
      id: method.id,
      category: method.category,
      available: true,
      comingSoon: false,
    };
  });
}
