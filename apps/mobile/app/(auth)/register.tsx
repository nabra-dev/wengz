import { useState } from "react";
import { View } from "react-native";
import { Link, router } from "expo-router";
import { ApiError, registerClient } from "../../src/lib/api";
import { t } from "../../src/i18n";
import { AuthBrand } from "../../src/components/AuthBrand";
import { SelectDropdown } from "../../src/components/SelectDropdown";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Muted,
  ScrollScreen,
  colors,
  AppText,
} from "../../src/components/ui";
import { fonts, typeScale } from "../../src/theme/brand";
import { row } from "../../src/rtl";

const COUNTRY_OPTIONS = [
  { value: "+20", label: "🇪🇬 +20" },
  { value: "+966", label: "🇸🇦 +966" },
  { value: "+971", label: "🇦🇪 +971" },
  { value: "+1", label: "🇺🇸 +1" },
  { value: "+44", label: "🇬🇧 +44" },
  { value: "+33", label: "🇫🇷 +33" },
  { value: "+49", label: "🇩🇪 +49" },
];

const FIELD_HEIGHT = 48;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+20");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setInfo(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      setError(t("auth.register.nameHint"));
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError(t("auth.register.invalidEmail"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.register.passwordHint"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.register.passwordsNotMatch"));
      return;
    }

    const digits = phone.replace(/\D/g, "");
    let phoneValue: string | undefined;
    if (digits) {
      if (digits.length < 7 || digits.length > 15) {
        setError(t("auth.register.invalidPhone"));
        return;
      }
      phoneValue = `${countryCode} ${digits}`;
    }

    setBusy(true);
    try {
      const result = await registerClient({
        name: trimmedName,
        email: trimmedEmail,
        password,
        phone: phoneValue,
      });
      setInfo(
        result.reapplied ? t("auth.register.reapplySuccess") : t("auth.register.successMessage")
      );
      setTimeout(() => {
        router.replace("/(auth)/login");
      }, 1600);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message || t("auth.register.registrationFailed"));
      } else {
        setError(t("auth.register.registrationFailed"));
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
      <AuthBrand height={48} />
      <Card>
        <AppText
          align="center"
          style={{
            color: colors.foreground,
            fontFamily: fonts.semiBold,
            ...typeScale.xl,
            marginBottom: 8,
          }}
        >
          {t("auth.register.title")}
        </AppText>
        <Muted style={{ marginBottom: 16, textAlign: "center" }}>
          {t("auth.register.description")}
        </Muted>

        {error ? <ErrorText>{error}</ErrorText> : null}
        {info ? <Muted style={{ marginBottom: 12 }}>{info}</Muted> : null}

        <Label required>{t("auth.register.nameLabel")}</Label>
        <Field
          autoCapitalize="words"
          placeholder={t("auth.register.namePlaceholder")}
          value={name}
          onChangeText={setName}
          editable={!busy}
        />

        <Label required>{t("auth.register.emailLabel")}</Label>
        <Field
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder={t("auth.register.emailPlaceholder")}
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />

        <Label>{t("auth.register.phoneLabel")}</Label>
        <View
          style={{
            ...row(),
            alignItems: "stretch",
            marginBottom: 12,
            height: FIELD_HEIGHT,
          }}
        >
          <SelectDropdown
            compact
            value={countryCode}
            options={COUNTRY_OPTIONS}
            onChange={setCountryCode}
          />
          <View style={{ width: 8 }} />
          <View style={{ flex: 1, minWidth: 0, height: FIELD_HEIGHT }}>
            <Field
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 15))}
              placeholder={t("auth.register.phonePlaceholder")}
              editable={!busy}
              style={{
                marginBottom: 0,
                height: FIELD_HEIGHT,
                paddingVertical: 0,
                textAlignVertical: "center",
              }}
            />
          </View>
        </View>
        <Muted style={{ marginBottom: 12 }}>{t("auth.register.phoneHint")}</Muted>

        <Label required>{t("auth.register.passwordLabel")}</Label>
        <Field
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!busy}
          placeholder={t("auth.register.passwordHint")}
        />

        <Label required>{t("auth.register.confirmPasswordLabel")}</Label>
        <Field
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!busy}
          placeholder={t("auth.register.confirmPasswordHint")}
        />

        <Button
          label={busy ? t("auth.register.creatingAccount") : t("auth.register.createAccountButton")}
          onPress={onSubmit}
          disabled={busy || Boolean(info)}
        />

        <View
          style={{
            ...row(),
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          <AppText compact style={{ color: colors.mutedForeground, ...typeScale.sm }}>
            {t("auth.register.haveAccount")}
          </AppText>
          <Link href="/(auth)/login">
            <AppText
              compact
              style={{
                color: colors.purple,
                ...typeScale.sm,
                fontFamily: fonts.medium,
              }}
            >
              {t("auth.register.signInLink")}
            </AppText>
          </Link>
        </View>

        <Button
          label={t("common.back")}
          onPress={() => router.replace("/(auth)/welcome")}
          variant="ghost"
        />
      </Card>
    </ScrollScreen>
  );
}
