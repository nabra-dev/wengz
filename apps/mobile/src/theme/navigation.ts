import { I18nManager, Platform } from "react-native";
import { BRAND, fonts, typeScale } from "./brand";

const c = BRAND.colors;

/** Horizontal push — iOS default; Android uses iOS-like slide and respects RTL. */
export function stackPushAnimation() {
  if (Platform.OS === "ios") return "default" as const;
  return I18nManager.isRTL ? ("ios_from_left" as const) : ("ios_from_right" as const);
}

/** Shared stack options — header chrome comes from `AppNavHeader`. */
export const brandStackOptions = {
  headerStyle: {
    backgroundColor: c.background,
  },
  headerShadowVisible: false,
  headerTintColor: c.yellow,
  headerTitleAlign: "center" as const,
  headerBackTitleVisible: false,
  // Prevent native-stack from reserving a second (often white) status-bar strip.
  headerStatusBarHeight: 0,
  // Do not set statusBarStyle here — it requires UIViewControllerBasedStatusBarAppearance=YES
  // and crashes Expo Go (host Info.plist can't be changed). Root `<StatusBar style="light" />` handles it.
  animation: stackPushAnimation(),
  animationDuration: 280,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  contentStyle: {
    backgroundColor: c.background,
  },
};

/** Form / compose screens — rise from the bottom. */
export const brandModalStackOptions = {
  ...brandStackOptions,
  animation: "slide_from_bottom" as const,
  animationDuration: 320,
};

/** Shared tab bar options — header chrome comes from `AppNavHeader`. */
export const brandTabBarOptions = {
  headerStyle: {
    backgroundColor: c.background,
  },
  headerShadowVisible: false,
  headerTintColor: c.yellow,
  headerTitleAlign: "center" as const,
  headerStatusBarHeight: 0,
  headerTitleStyle: {
    fontFamily: fonts.semiBold,
    fontSize: typeScale.md.fontSize,
  },
  sceneStyle: {
    backgroundColor: c.background,
  },
  animation: "fade" as const,
  transitionSpec: {
    animation: "timing" as const,
    config: { duration: 220 },
  },
  tabBarStyle: {
    backgroundColor: c.card,
    borderTopColor: c.border,
    borderTopWidth: 1,
    height: 76,
    paddingTop: 8,
    paddingBottom: 12,
  },
  tabBarActiveTintColor: c.yellow,
  tabBarInactiveTintColor: c.mutedForeground,
  tabBarItemStyle: {
    paddingVertical: 2,
  },
  tabBarLabelStyle: {
    fontFamily: fonts.medium,
    fontSize: typeScale.sm.fontSize,
    marginTop: 4,
  },
  tabBarHideOnKeyboard: true,
};
