import { useState } from "react";
import { router } from "expo-router";
import { requestPasswordReset } from "../../src/lib/api";
import { t } from "../../src/i18n";
import { AuthBrand } from "../../src/components/AuthBrand";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Muted,
  ScrollScreen,
} from "../../src/components/ui";

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
    <ScrollScreen
      edges={["top", "left", "right", "bottom"]}
      contentContainerStyle={{ justifyContent: "center", paddingVertical: 40 }}
    >
      <AuthBrand height={48} />
      <Card>
        <Label>{t("auth.forgotPassword.title")}</Label>
        <Muted>{t("auth.forgotPassword.description")}</Muted>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {done ? (
          <>
            <Muted>{t("auth.forgotPassword.successDescription")}</Muted>
            <Button
              label={t("auth.forgotPassword.backToLogin")}
              onPress={() => router.replace("/(auth)/login")}
              variant="secondary"
            />
          </>
        ) : (
          <>
            <Field
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder={t("auth.forgotPassword.emailPlaceholder")}
              value={email}
              onChangeText={setEmail}
            />
            <Button
              label={
                busy ? t("auth.forgotPassword.submitting") : t("auth.forgotPassword.submitButton")
              }
              onPress={onSubmit}
              disabled={busy}
            />
            <Button
              label={t("auth.forgotPassword.backToLogin")}
              onPress={() => router.back()}
              variant="ghost"
            />
          </>
        )}
      </Card>
    </ScrollScreen>
  );
}
