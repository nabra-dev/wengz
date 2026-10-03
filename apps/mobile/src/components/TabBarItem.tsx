import type { ComponentProps } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, typeScale, BRAND } from "../theme/brand";
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
  return (
    <View style={{ alignItems: "center", justifyContent: "center", minWidth: 72, maxWidth: 96 }}>
      <View
        style={{
          width: 44,
          height: 28,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? "rgba(224,248,64,0.12)" : "transparent",
        }}
      >
        <Ionicons
          name={focused ? activeIcon : inactiveIcon}
          size={focused ? 24 : 22}
          color={color}
        />
      </View>
      <AppText
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          marginTop: 3,
          color,
          fontFamily: focused ? fonts.semiBold : fonts.medium,
          ...typeScale.sm,
          textAlign: "center",
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
            backgroundColor: BRAND.colors.yellow,
          }}
        />
      ) : (
        <View style={{ marginTop: 3, height: 2 }} />
      )}
    </View>
  );
}
