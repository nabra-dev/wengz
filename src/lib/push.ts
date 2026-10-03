import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type RegisterPushDeviceInput = {
  userId: string;
  token: string;
  platform: "ios" | "android" | "web";
  locale?: string;
};

export async function registerPushDevice(input: RegisterPushDeviceInput) {
  const token = input.token.trim();
  if (!token) throw new Error("Push token required");

  return db.pushDevice.upsert({
    where: { token },
    create: {
      userId: input.userId,
      token,
      platform: input.platform,
      locale: input.locale === "ar" ? "ar" : "en",
    },
    update: {
      userId: input.userId,
      platform: input.platform,
      locale: input.locale === "ar" ? "ar" : "en",
    },
  });
}

export async function unregisterPushDevice(userId: string, token: string) {
  await db.pushDevice.deleteMany({
    where: { userId, token: token.trim() },
  });
}

/** Best-effort Expo push fan-out for a user (no-op if no devices). */
export async function sendPushToUser(params: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const devices = await db.pushDevice.findMany({
    where: { userId: params.userId },
    select: { token: true },
    take: 50,
  });
  if (devices.length === 0) return { sent: 0 };

  const messages = devices.map((d) => ({
    to: d.token,
    sound: "default" as const,
    title: params.title,
    body: params.body,
    data: params.data ?? {},
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      logger.error("Expo push failed", await res.text());
      return { sent: 0 };
    }
    return { sent: messages.length };
  } catch (error) {
    logger.error("Expo push error", error);
    return { sent: 0 };
  }
}
