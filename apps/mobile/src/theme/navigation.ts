import { BRAND, fonts, typeScale } from "./brand";

const c = BRAND.colors;

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
  contentStyle: {
    backgroundColor: c.background,
  },
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
