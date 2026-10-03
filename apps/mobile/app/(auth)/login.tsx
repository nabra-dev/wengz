import { useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../src/providers/auth";
import { t } from "../../src/i18n";
import { ApiError } from "../../src/lib/api";
import { AuthBrand } from "../../src/components/AuthBrand";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  ScrollScreen,
  colors,
  AppText,
} from "../../src/components/ui";
import { fonts, typeScale } from "../../src/theme/brand";
import { row } from "../../src/rtl";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError(t("auth.login.invalidCredentials"));
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      if (e instanceof Error && e.message === "CLIENTS_ONLY") {
        setError(t("auth.login.invalidCredentials"));
      } else if (e instanceof ApiError) {
        const msg = e.message;
        if (msg.includes("PENDING")) setError(t("auth.login.pendingApproval"));
        else if (msg.includes("REJECTED")) setError(t("auth.login.accountRejected"));
        else if (msg.includes("MAINTENANCE")) setError(t("auth.login.maintenanceLoginBlocked"));
        else if (e.code === "NETWORK_ERROR") setError(msg);
        else setError(t("auth.login.invalidCredentials"));
      } else {
        setError(t("auth.login.errorMessage"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollScreen
      edges={["top", "left", "right", "bottom"]}
      contentContainerStyle={{ justifyContent: "center", paddingVertical: 40 }}
    >
      <AuthBrand height={52} />

      <Card>
        <AppText
          align="center"
          style={{
            color: colors.foreground,
            fontFamily: fonts.semiBold,
            ...typeScale.xl,
            marginBottom: 16,
          }}
        >
          {t("auth.login.title")}
        </AppText>

        {error ? <ErrorText>{error}</ErrorText> : null}

        <Label>{t("auth.login.emailLabel")}</Label>
        <Field
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder={t("auth.login.emailPlaceholder")}
          value={email}
          onChangeText={setEmail}
        />
        <View
          style={{
            ...row(),
            justifyContent: "space-between",
            alignItems: "center",
            alignSelf: "stretch",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <AppText
            compact
            style={{
              color: colors.foreground,
              ...typeScale.sm,
              fontFamily: fonts.medium,
              flexShrink: 1,
            }}
          >
            {t("auth.login.passwordLabel")}
          </AppText>
          <Link href="/(auth)/forgot-password">
            <AppText
              compact
              style={{
                color: colors.purple,
                ...typeScale.sm,
                fontFamily: fonts.medium,
              }}
            >
              {t("auth.login.forgotPassword")}
            </AppText>
          </Link>
        </View>
        <Field secureTextEntry value={password} onChangeText={setPassword} />
        <Button
          label={busy ? t("auth.login.signingIn") : t("auth.login.signInButton")}
          onPress={onSubmit}
          disabled={busy}
        />
      </Card>
    </ScrollScreen>
  );
}
