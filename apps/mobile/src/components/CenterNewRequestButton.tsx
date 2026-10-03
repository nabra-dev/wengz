import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BRAND, fonts, typeScale } from "../theme/brand";
import { t } from "../i18n";
import { AppText } from "./typography";

/** Compact FAB — half sits above the tab bar edge. */
const SIZE = 44;
const HALF = SIZE / 2;

/**
 * Elevated center tab action — brand FAB that opens create request.
 */
export function CenterNewRequestButton() {
  const pulse = useSharedValue(0);
  const press = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.12, 0.28]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.08]) }],
  }));

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.92]) }],
  }));

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-start",
        zIndex: 20,
        paddingHorizontal: 4,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          width: SIZE + 12,
          height: SIZE,
          marginTop: -HALF,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              width: SIZE + 6,
              height: SIZE + 6,
              borderRadius: (SIZE + 6) / 2,
              backgroundColor: BRAND.colors.purple,
            },
            ringStyle,
          ]}
        />

        {/* Collar matching tab bar so the FAB reads as cut through the bar */}
        <View
          style={{
            position: "absolute",
            width: SIZE + 8,
            height: SIZE + 8,
            borderRadius: (SIZE + 8) / 2,
            backgroundColor: BRAND.colors.card,
          }}
        />

        <Pressable
          onPressIn={() => {
            press.value = withSpring(1, { damping: 16, stiffness: 320 });
          }}
          onPressOut={() => {
            press.value = withSpring(0, { damping: 14, stiffness: 260 });
          }}
          onPress={() => router.push("/requests/create")}
          accessibilityRole="button"
          accessibilityLabel={t("tabs.newRequest")}
          hitSlop={8}
        >
          <Animated.View
            style={[
              {
                width: SIZE,
                height: SIZE,
                borderRadius: HALF,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: BRAND.colors.purple,
                borderWidth: 2,
                borderColor: BRAND.colors.card,
                shadowColor: "#000",
                shadowOpacity: 0.35,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 5,
              },
              fabStyle,
            ]}
          >
            <Ionicons name="add" size={26} color={BRAND.colors.foreground} />
          </Animated.View>
        </Pressable>
      </View>

      <AppText
        numberOfLines={1}
        style={{
          marginTop: 10,
          paddingHorizontal: 2,
          color: BRAND.colors.mutedForeground,
          fontFamily: fonts.medium,
          ...typeScale.sm,
          textAlign: "center",
        }}
      >
        {t("tabs.newRequest")}
      </AppText>
    </View>
  );
}
