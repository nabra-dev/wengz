import { I18nManager, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BrandLogo } from "./BrandLogo";
import { BRAND } from "../theme/brand";
import { t } from "../i18n";

const c = BRAND.colors;
const LOGO_HEIGHT = 32;

/** Centered brand mark (kept for any title-slot usage). */
export function AppHeaderTitle() {
  return (
    <View style={styles.titleWrap}>
      <BrandLogo height={LOGO_HEIGHT} tone="yellow" />
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
  const showBack = back != null;
  const rtl = I18nManager.isRTL;

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.bar}>
        <View style={styles.side}>
          {showBack ? (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={t("common.back", { defaultValue: "Back" })}
            >
              {/* Glyphs don’t mirror with RTL — flip the chevron explicitly. */}
              <Ionicons
                name={rtl ? "chevron-forward" : "chevron-back"}
                size={26}
                color={c.yellow}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.center}>
          <BrandLogo height={LOGO_HEIGHT} tone="yellow" />
        </View>
        <View style={styles.side} />
      </View>
      <View style={styles.border} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleWrap: {
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  safe: {
    backgroundColor: c.background,
  },
  bar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    backgroundColor: c.background,
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
  border: {
    height: 1,
    backgroundColor: c.border,
  },
});
