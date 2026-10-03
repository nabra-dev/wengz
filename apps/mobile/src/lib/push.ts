import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerPushDevice } from "./api";

/** Expo Go cannot register remote push on recent SDKs — skip quietly. */
function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

if (!isExpoGo()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPush(): Promise<string | null> {
  if (isExpoGo()) return null;
  if (!Device.isDevice) return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

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
    return token;
  } catch {
    return null;
  }
}
