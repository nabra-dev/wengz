import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { requestPasswordReset } from "../../src/lib/api";
import { t } from "../../src/i18n";
import { BrandLogo } from "../../src/components/BrandLogo";
import { Button, Card, ErrorText, Field, Label, Muted, Screen } from "../../src/components/ui";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: "center", marginBottom: 24, marginTop: 48 }}>
        <BrandLogo height={36} tone="yellow" />
      </View>
      <Card>
        <Label>{t("auth.forgotTitle")}</Label>
        <Muted>{t("auth.forgotHint")}</Muted>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {done ? (
          <Muted>OK — check your email</Muted>
        ) : (
          <>
            <Field
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder={t("auth.email")}
              value={email}
              onChangeText={setEmail}
            />
            <Button
              label={busy ? t("common.loading") : t("auth.sendReset")}
              onPress={onSubmit}
              disabled={busy}
            />
          </>
        )}
        <Button label={t("common.back")} onPress={() => router.back()} variant="ghost" />
      </Card>
    </Screen>
  );
}
