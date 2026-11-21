import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BrandLogo } from "./BrandLogo";
import { useTheme } from "../providers/theme";
import { t } from "../i18n";
import { backChevron, row } from "../rtl";

const LOGO_HEIGHT = 32;

/** Centered brand mark (kept for any title-slot usage). */
export function AppHeaderTitle() {
  const { isDark } = useTheme();
  return (
    <View style={styles.titleWrap}>
      <BrandLogo height={LOGO_HEIGHT} tone={isDark ? "yellow" : "purple"} />
    </View>
  );
}

type NavHeaderProps = {
  navigation: { canGoBack: () => boolean; goBack: () => void };
  /** Present on native-stack nested screens — show back chevron. */
  back?: unknown;
};

/**
 * Single header chrome for Tabs + Stack.
 * Theme toggle lives on Profile only (not in the global header).
 */
export function AppNavHeader({ navigation, back }: NavHeaderProps) {
  const { colors, isDark } = useTheme();
  const showBack = back != null;

  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
      <View style={[styles.bar, row(), { backgroundColor: colors.background }]}>
        <View style={styles.side}>
          {showBack ? (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={t("common.back", { defaultValue: "Back" })}
            >
              <Ionicons name={backChevron()} size={26} color={colors.accent} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.center}>
          <BrandLogo height={LOGO_HEIGHT} tone={isDark ? "yellow" : "purple"} />
        </View>
        <View style={styles.side} />
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleWrap: {
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    height: 56,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  side: {
    width: 52,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    padding: 8,
  },
});
