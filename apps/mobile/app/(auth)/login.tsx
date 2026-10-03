import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
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
  Screen,
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
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      if (e instanceof Error && e.message === "CLIENTS_ONLY") {
        setError(t("auth.clientsOnly"));
      } else if (e instanceof ApiError) {
        const msg = e.message.toLowerCase();
        if (msg.includes("pending")) setError(t("auth.pendingApproval"));
        else if (msg.includes("reject") || msg.includes("suspend")) setError(t("auth.rejected"));
        else setError(e.message);
      } else {
        setError(t("common.error"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingVertical: 40,
          }}
          keyboardShouldPersistTaps="handled"
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
              {t("auth.loginTitle")}
            </Text>
            <Muted style={{ textAlign: "center", marginBottom: 18 }}>
              Stick with Wengz & get it done
            </Muted>

            {error ? <ErrorText>{error}</ErrorText> : null}

            <Label>{t("auth.email")}</Label>
            <Field
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@example.com"
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
              <Label>{t("auth.password")}</Label>
              <Link href="/(auth)/forgot-password">
                <Text
                  style={{
                    color: colors.purple,
                    fontSize: 12,
                    fontFamily: fonts.medium,
                    marginBottom: 6,
                  }}
                >
                  {t("auth.forgot")}
                </Text>
              </Link>
            </View>
            <Field
              secureTextEntry
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
            />
            <Button
              label={busy ? t("common.loading") : t("auth.signIn")}
              onPress={onSubmit}
              disabled={busy}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
