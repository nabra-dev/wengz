import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";
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
 * SafeAreaView paints the status-bar inset with brand background (no white gap).
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
              <Ionicons
                name={backChevron()}
                size={26}
                color={isDark ? colors.yellow : colors.purple}
              />
            </Pressable>
          ) : (
            <ThemeToggle size={34} />
          )}
        </View>
        <View style={styles.center}>
          <BrandLogo height={LOGO_HEIGHT} tone={isDark ? "yellow" : "purple"} />
        </View>
        <View style={[styles.side, { alignItems: "flex-end" }]}>
          {showBack ? <ThemeToggle size={34} /> : null}
        </View>
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
