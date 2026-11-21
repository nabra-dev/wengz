import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthBrand } from "../../src/components/AuthBrand";
import { AuthToolbar } from "../../src/components/AuthToolbar";
import { Button, AppText } from "../../src/components/ui";
import { useTheme } from "../../src/providers/theme";
import { t } from "../../src/i18n";
import { fonts, typeScale } from "../../src/theme/brand";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + 10,
        paddingBottom: Math.max(insets.bottom, 16) + 8,
        paddingHorizontal: 16,
      }}
    >
      <AuthToolbar />

      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 }}
      >
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

      <View style={{ gap: 12, paddingHorizontal: 8 }}>
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
