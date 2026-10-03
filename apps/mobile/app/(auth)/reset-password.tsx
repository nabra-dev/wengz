import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { resetPassword } from "../../src/lib/api";
import { t } from "../../src/i18n";
import { AuthBrand } from "../../src/components/AuthBrand";
import { Button, Card, ErrorText, Field, Label, ScrollScreen } from "../../src/components/ui";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!token) {
      setError(t("auth.resetPassword.missingToken"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.resetPassword.required"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.resetPassword.mismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(String(token), password, confirm);
      router.replace("/(auth)/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollScreen
      edges={["top", "left", "right", "bottom"]}
      contentContainerStyle={{ justifyContent: "center", paddingVertical: 40 }}
    >
      <AuthBrand height={36} />
      <Card>
        <Label>{t("auth.resetPassword.title")}</Label>
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Label>{t("auth.resetPassword.newPasswordLabel")}</Label>
        <Field secureTextEntry value={password} onChangeText={setPassword} />
        <Label>{t("auth.resetPassword.confirmPasswordLabel")}</Label>
        <Field secureTextEntry value={confirm} onChangeText={setConfirm} />
        <Button
          label={busy ? t("auth.resetPassword.submitting") : t("auth.resetPassword.submitButton")}
          onPress={onSubmit}
          disabled={busy}
          variant="secondary"
        />
      </Card>
    </ScrollScreen>
  );
}
