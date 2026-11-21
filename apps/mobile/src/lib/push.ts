import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { router } from "expo-router";
import { registerPushDevice } from "./api";
import { requestIdFromNotificationLink } from "./request-realtime";

/** Expo Go cannot register remote push on recent SDKs — local banners still work. */
function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

let handlerReady = false;
let remotePushRegistered = false;
let responseSub: { remove: () => void } | null = null;

async function getNotifications() {
  const Notifications = await import("expo-notifications");
  if (!handlerReady) {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const type = String(notification.request.content.data?.type ?? "");
        const isRequestUpdate =
          type === "message" || type === "status_change" || type === "assignment";
        return {
          shouldShowAlert: true,
          shouldPlaySound: isRequestUpdate,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });
    handlerReady = true;
  }
  return Notifications;
}

export function hasRemotePush(): boolean {
  return remotePushRegistered;
}

/** Ask for notification permission (local + remote). */
export async function ensureNotificationPermissions(): Promise<boolean> {
  try {
    const Notifications = await getNotifications();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function registerForPush(): Promise<string | null> {
  remotePushRegistered = false;
  const permitted = await ensureNotificationPermissions();
  if (!permitted) return null;

  // Remote device tokens need a native build; Expo Go only gets local notifications.
  if (isExpoGo() || !Device.isDevice) return null;

  try {
    const Notifications = await getNotifications();

    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

    if (!projectId || projectId === "replace-with-eas-project-id") {
      return null;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes.data;
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
    await registerPushDevice(token, platform);
    remotePushRegistered = true;
    return token;
  } catch {
    return null;
  }
}

export type RequestUpdateNotificationPayload = {
  title: string;
  body: string;
  type?: string | null;
  requestId?: string | null;
  link?: string | null;
  notificationId?: string | null;
};

/** Immediate OS banner for a request update (chat, status, assignment). */
export async function presentRequestUpdateNotification(
  payload: RequestUpdateNotificationPayload
): Promise<void> {
  const title = payload.title?.trim();
  const body = payload.body?.trim();
  if (!title && !body) return;

  const permitted = await ensureNotificationPermissions();
  if (!permitted) return;

  try {
    const Notifications = await getNotifications();
    const requestId = payload.requestId || requestIdFromNotificationLink(payload.link) || undefined;
    const kind = payload.type || "message";
    const identifier = payload.notificationId
      ? `wengz-${kind}-${payload.notificationId}`
      : requestId
        ? `wengz-${kind}-${requestId}-${Date.now()}`
        : undefined;

    await Notifications.scheduleNotificationAsync({
      ...(identifier ? { identifier } : {}),
      content: {
        title: title || "Wengz",
        body: body || "",
        sound: "default",
        data: {
          type: kind,
          ...(requestId ? { requestId } : {}),
          ...(payload.link ? { link: payload.link } : {}),
          ...(payload.notificationId ? { notificationId: payload.notificationId } : {}),
        },
      },
      trigger: null,
    });
  } catch {
    // best-effort
  }
}

/** @deprecated use presentRequestUpdateNotification */
export async function presentChatMessageNotification(
  payload: RequestUpdateNotificationPayload
): Promise<void> {
  return presentRequestUpdateNotification({ ...payload, type: payload.type || "message" });
}

function openFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const requestId =
    (typeof data.requestId === "string" && data.requestId) ||
    requestIdFromNotificationLink(typeof data.link === "string" ? data.link : null);
  if (requestId) {
    router.push(`/(app)/requests/${requestId}`);
  }
}

/** Tap on a notification → open the request thread. Call once while authenticated. */
export async function setupNotificationResponseListener(): Promise<() => void> {
  try {
    const Notifications = await getNotifications();
    responseSub?.remove();
    responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotificationData(
        response.notification.request.content.data as Record<string, unknown>
      );
    });

    const last = await Notifications.getLastNotificationResponseAsync();
    if (last) {
      openFromNotificationData(last.notification.request.content.data as Record<string, unknown>);
    }

    return () => {
      responseSub?.remove();
      responseSub = null;
    };
  } catch {
    return () => undefined;
  }
}
