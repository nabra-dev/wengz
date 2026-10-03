import { BRAND, fonts } from "./brand";

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
  statusBarStyle: "light" as const,
  statusBarBackgroundColor: c.background,
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
    fontSize: 16,
  },
  sceneStyle: {
    backgroundColor: c.background,
  },
  tabBarStyle: {
    backgroundColor: c.card,
    borderTopColor: c.border,
    borderTopWidth: 1,
    height: 68,
    paddingTop: 8,
    paddingBottom: 10,
  },
  tabBarActiveTintColor: c.yellow,
  tabBarInactiveTintColor: c.mutedForeground,
  tabBarLabelStyle: {
    fontFamily: fonts.medium,
    fontSize: 10,
    marginTop: 2,
  },
};
