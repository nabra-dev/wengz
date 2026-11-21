import type { ComponentProps } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, typeScale } from "../theme/brand";
import { useTheme } from "../providers/theme";
import { AppText } from "./typography";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  label: string;
  color: string;
  focused: boolean;
  activeIcon: IconName;
  inactiveIcon: IconName;
};

/** Tab icon + label with a clear active state. */
export function TabBarItem({ label, color, focused, activeIcon, inactiveIcon }: Props) {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", minWidth: 72, maxWidth: 96 }}>
      <View
        style={{
          width: 44,
          height: 28,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused
            ? isDark
              ? "rgba(224,248,64,0.12)"
              : "rgba(105,13,212,0.1)"
            : "transparent",
        }}
      >
        <Ionicons
          name={focused ? activeIcon : inactiveIcon}
          size={focused ? 24 : 22}
          color={color}
        />
      </View>
      <AppText
        align="center"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          marginTop: 3,
          color,
          fontFamily: focused ? fonts.semiBold : fonts.medium,
          ...typeScale.sm,
          width: "100%",
        }}
      >
        {label}
      </AppText>
      {focused ? (
        <View
          style={{
            marginTop: 3,
            width: 16,
            height: 2,
            borderRadius: 1,
            backgroundColor: colors.accent,
          }}
        />
      ) : (
        <View style={{ marginTop: 3, height: 2 }} />
      )}
    </View>
  );
}
