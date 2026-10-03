import { useState } from "react";
import { Text, View } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../src/providers/auth";
import { t } from "../../src/i18n";
import { ApiError } from "../../src/lib/api";
import { BrandLogo } from "../../src/components/BrandLogo";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Muted,
  ScrollScreen,
  colors,
} from "../../src/components/ui";
import { fonts } from "../../src/theme/brand";

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
      <View style={{ alignItems: "center", marginBottom: 28 }}>
        <BrandLogo height={40} tone="yellow" />
      </View>

      <Card>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: fonts.semiBold,
            fontSize: 20,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 6,
          }}
        >
          {t("auth.login.title")}
        </Text>
        <Muted style={{ textAlign: "center", marginBottom: 18 }}>
          {t("auth.login.description")}
        </Muted>

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
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Label>{t("auth.login.passwordLabel")}</Label>
          <Link href="/(auth)/forgot-password">
            <Text
              style={{
                color: colors.purple,
                fontSize: 12,
                fontFamily: fonts.medium,
                marginBottom: 6,
              }}
            >
              {t("auth.login.forgotPassword")}
            </Text>
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
