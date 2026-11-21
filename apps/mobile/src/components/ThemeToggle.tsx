import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../providers/theme";
import { t } from "../i18n";

/** Compact sun / moon control for light ↔ dark. */
export function ThemeToggle({ size = 36 }: { size?: number }) {
  const { isDark, colors, toggleScheme } = useTheme();
  const icon = isDark ? "sunny-outline" : "moon-outline";
  const label = isDark ? t("common.themeLight") : t("common.themeDark");

  return (
    <Pressable
      onPress={toggleScheme}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.chip,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={colors.foreground} />
    </Pressable>
  );
}
