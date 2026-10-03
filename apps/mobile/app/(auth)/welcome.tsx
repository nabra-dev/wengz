import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthBrand } from "../../src/components/AuthBrand";
import { Button, AppText, colors } from "../../src/components/ui";
import { useLocale } from "../../src/providers/locale";
import { t, type AppLocale } from "../../src/i18n";
import { fonts, typeScale } from "../../src/theme/brand";
import { row } from "../../src/rtl";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { locale, setLocale } = useLocale();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + 16,
        paddingBottom: Math.max(insets.bottom, 16) + 8,
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          ...row(),
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <View style={{ ...row(), gap: 6 }}>
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
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: active ? "rgba(105,13,212,0.35)" : "rgba(255,255,255,0.06)",
                }}
              >
                <AppText
                  compact
                  style={{
                    color: active ? colors.yellow : colors.mutedForeground,
                    fontFamily: fonts.medium,
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

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AuthBrand height={72} />
        <AppText
          align="center"
          style={{
            color: colors.foreground,
            fontFamily: fonts.semiBold,
            ...typeScale.display,
            marginTop: 8,
            marginBottom: 10,
          }}
        >
          {t("auth.welcome.headline")}
        </AppText>
        <AppText
          align="center"
          style={{
            color: colors.mutedForeground,
            fontFamily: fonts.regular,
            ...typeScale.md,
            maxWidth: 320,
            lineHeight: 24,
          }}
        >
          {t("auth.welcome.tagline")}
        </AppText>
      </View>

      <View style={{ gap: 12 }}>
        <Button label={t("auth.welcome.signIn")} onPress={() => router.push("/(auth)/login")} />
        <Button
          label={t("auth.welcome.createAccount")}
          onPress={() => router.push("/(auth)/register")}
          variant="secondary"
        />
      </View>
    </View>
  );
}
