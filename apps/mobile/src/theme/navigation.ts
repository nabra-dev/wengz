import { Platform } from "react-native";
import { fonts, typeScale } from "./brand";
import type { ThemeColors } from "./palettes";
import { darkPalette } from "./palettes";
import { manualMirror } from "../rtl";

/**
 * Horizontal push — iOS default and native RTL mirror the slide themselves,
 * so only manual-mirror mode has to flip it.
 */
export function stackPushAnimation() {
  if (Platform.OS === "ios") return "default" as const;
  return manualMirror() ? ("ios_from_left" as const) : ("ios_from_right" as const);
}

/** Shared stack options — header chrome comes from `AppNavHeader`. */
export function brandStackOptions(c: ThemeColors = darkPalette) {
  return {
    headerStyle: {
      backgroundColor: c.background,
    },
    headerShadowVisible: false,
    headerTintColor: c.yellow,
    headerTitleAlign: "center" as const,
    headerBackTitleVisible: false,
    headerStatusBarHeight: 0,
    get animation() {
      return stackPushAnimation();
    },
    animationDuration: 280,
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
    contentStyle: {
      backgroundColor: c.background,
    },
  };
}

/** Form / compose screens — rise from the bottom. */
export function brandModalStackOptions(c: ThemeColors = darkPalette) {
  return {
    ...brandStackOptions(c),
    animation: "slide_from_bottom" as const,
    animationDuration: 320,
  };
}

/** Shared tab bar options — header chrome comes from `AppNavHeader`. */
export function brandTabBarOptions(c: ThemeColors = darkPalette) {
  return {
    headerStyle: {
      backgroundColor: c.background,
    },
    headerShadowVisible: false,
    headerTintColor: c.yellow,
    headerTitleAlign: "center" as const,
    headerStatusBarHeight: 0,
    get headerTitleStyle() {
      return {
        fontFamily: fonts.semiBold,
        fontSize: typeScale.md.fontSize,
      };
    },
    sceneStyle: {
      backgroundColor: c.background,
    },
    animation: "none" as const,
    tabBarStyle: {
      backgroundColor: c.card,
      borderTopColor: c.border,
      borderTopWidth: 1,
      height: 78,
      paddingTop: 8,
      paddingBottom: 12,
      overflow: "visible" as const,
    },
    tabBarActiveTintColor: c.yellow,
    tabBarInactiveTintColor: c.mutedForeground,
    tabBarItemStyle: {
      paddingVertical: 2,
    },
    get tabBarLabelStyle() {
      return {
        fontFamily: fonts.medium,
        fontSize: typeScale.sm.fontSize,
        marginTop: 4,
      };
    },
    tabBarHideOnKeyboard: true,
  };
}
