import type { Prisma } from "@prisma/client";

export const CREDIT_PRICE_USD_KEY = "credit_price_usd";
export const PROVIDER_COMMISSION_PERCENT_KEY = "provider_commission_percent";

export const DEFAULT_CREDIT_PRICE_USD = 1;
export const DEFAULT_PROVIDER_COMMISSION_PERCENT = 10;

export type FinanceSettings = {
  creditPriceUsd: number;
  commissionPercent: number;
};

type SettingsClient = {
  systemSettings: {
    findMany: (args: {
      where: { key: { in: string[] } };
      select: { key: true; value: true };
    }) => Promise<Array<{ key: string; value: Prisma.JsonValue }>>;
  };
};

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseNonNegativeNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return n;
}

function parsePercent(value: unknown, fallback: number): number {
  const n = parseNonNegativeNumber(value, fallback);
  return Math.min(100, n);
}

export function parseFinanceSettings(
  rows: Array<{ key: string; value: Prisma.JsonValue }>
): FinanceSettings {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const priceValue = asRecord(byKey.get(CREDIT_PRICE_USD_KEY));
  const commissionValue = asRecord(byKey.get(PROVIDER_COMMISSION_PERCENT_KEY));

  return {
    creditPriceUsd: parseNonNegativeNumber(
      priceValue?.amount,
      DEFAULT_CREDIT_PRICE_USD
    ),
    commissionPercent: parsePercent(
      commissionValue?.percent,
      DEFAULT_PROVIDER_COMMISSION_PERCENT
    ),
  };
}

export async function getFinanceSettings(db: SettingsClient): Promise<FinanceSettings> {
  const rows = await db.systemSettings.findMany({
    where: {
      key: {
        in: [CREDIT_PRICE_USD_KEY, PROVIDER_COMMISSION_PERCENT_KEY],
      },
    },
    select: { key: true, value: true },
  });

  return parseFinanceSettings(rows);
}
