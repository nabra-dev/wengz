import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { resetPassword } from "../../src/lib/api";
import { t } from "../../src/i18n";
import { BrandLogo } from "../../src/components/BrandLogo";
import { Button, Card, ErrorText, Field, Label, Screen } from "../../src/components/ui";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!token) {
      setError("Missing token");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(String(token), password);
      router.replace("/(auth)/login");
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
        <Label>{t("auth.resetTitle")}</Label>
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Field
          secureTextEntry
          placeholder={t("auth.newPassword")}
          value={password}
          onChangeText={setPassword}
        />
        <Button
          label={busy ? t("common.loading") : t("common.submit")}
          onPress={onSubmit}
          disabled={busy}
          variant="secondary"
        />
      </Card>
    </Screen>
  );
}
