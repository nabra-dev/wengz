import { Pressable, View } from "react-native";
import { ThemeToggle } from "./ThemeToggle";
import { AppText } from "./ui";
import { useLocale } from "../providers/locale";
import { useTheme } from "../providers/theme";
import { t, type AppLocale } from "../i18n";
import { fonts, typeScale } from "../theme/brand";
import { row } from "../rtl";

/** Language + theme controls for auth screens. */
export function AuthToolbar() {
  const { locale, setLocale } = useLocale();
  const { colors, isDark } = useTheme();

  return (
    <View
      style={{
        ...row(),
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
        width: "100%",
      }}
    >
      <ThemeToggle />
      <View
        style={{
          ...row(),
          backgroundColor: colors.chip,
          borderRadius: 12,
          padding: 3,
          gap: 2,
        }}
      >
        {(
          [
            { key: "en" as AppLocale, label: "EN" },
            { key: "ar" as AppLocale, label: "ع" },
          ] as const
        ).map((opt) => {
          const active = locale === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => void setLocale(opt.key)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t("common.language")}
              accessibilityState={{ selected: active }}
              style={{
                minWidth: 36,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 10,
                backgroundColor: active
                  ? isDark
                    ? "rgba(105,13,212,0.45)"
                    : colors.purple
                  : "transparent",
                alignItems: "center",
              }}
            >
              <AppText
                compact
                style={{
                  color: active ? (isDark ? colors.yellow : "#FFFFFF") : colors.mutedForeground,
                  fontFamily: fonts.semiBold,
                  ...typeScale.sm,
                }}
              >
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
