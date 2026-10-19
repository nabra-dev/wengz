import type { Prisma } from "@prisma/client";

export const SIGNUP_APPROVAL_KEY = "signup_approval";

export type SignupApprovalSettings = {
  /** When true, new clients start as PENDING until staff approve. */
  clientPendingApproval: boolean;
  /** When true, new creators start as PENDING until staff approve. */
  providerPendingApproval: boolean;
};

/** Match current product default: both roles require approval. */
export const DEFAULT_SIGNUP_APPROVAL_SETTINGS: SignupApprovalSettings = {
  clientPendingApproval: true,
  providerPendingApproval: true,
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

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

export function parseSignupApprovalSettings(
  value: Prisma.JsonValue | null | undefined
): SignupApprovalSettings {
  const record = asRecord(value);
  if (!record) return { ...DEFAULT_SIGNUP_APPROVAL_SETTINGS };

  return {
    clientPendingApproval: parseBool(
      record.clientPendingApproval,
      DEFAULT_SIGNUP_APPROVAL_SETTINGS.clientPendingApproval
    ),
    providerPendingApproval: parseBool(
      record.providerPendingApproval,
      DEFAULT_SIGNUP_APPROVAL_SETTINGS.providerPendingApproval
    ),
  };
}

export async function getSignupApprovalSettings(
  db: SettingsClient
): Promise<SignupApprovalSettings> {
  const setting = await db.systemSettings.findUnique({
    where: { key: SIGNUP_APPROVAL_KEY },
    select: { value: true },
  });
  return parseSignupApprovalSettings(setting?.value);
}
