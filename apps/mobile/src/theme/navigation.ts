import { BRAND, fonts } from "./brand";

const c = BRAND.colors;

/** Shared native stack header chrome — logo-centered identity on every screen. */
export const brandStackOptions = {
  headerStyle: {
    backgroundColor: c.background,
  },
  headerShadowVisible: false,
  headerTintColor: c.yellow,
  headerTitleAlign: "center" as const,
  headerBackTitleVisible: false,
  headerTitleStyle: {
    fontFamily: fonts.semiBold,
    color: c.foreground,
    fontSize: 16,
  },
  contentStyle: {
    backgroundColor: c.background,
  },
};

/** Shared tab bar + header chrome. */
export const brandTabBarOptions = {
  headerStyle: {
    backgroundColor: c.background,
    borderBottomColor: c.border,
    borderBottomWidth: 1,
  },
  headerShadowVisible: false,
  headerTintColor: c.yellow,
  headerTitleAlign: "center" as const,
  headerTitleStyle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
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
