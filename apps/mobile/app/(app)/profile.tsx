import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { changePassword, getProfile, updateProfile } from "../../src/lib/api";
import { useAuth } from "../../src/providers/auth";
import { useLocale } from "../../src/providers/locale";
import { t, type AppLocale } from "../../src/i18n";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Loading,
  Muted,
  PageHeader,
  ScrollScreen,
  SegmentedTabs,
} from "../../src/components/ui";
import { SelectDropdown } from "../../src/components/SelectDropdown";
import { row } from "../../src/rtl";
import { useDebugUi } from "../../src/debug/DebugProvider";

type Tab = "profile" | "security";

const COUNTRY_OPTIONS = [
  { value: "+20", label: "🇪🇬 +20" },
  { value: "+966", label: "🇸🇦 +966" },
  { value: "+971", label: "🇦🇪 +971" },
  { value: "+1", label: "🇺🇸 +1" },
  { value: "+44", label: "🇬🇧 +44" },
  { value: "+33", label: "🇫🇷 +33" },
  { value: "+49", label: "🇩🇪 +49" },
];

function splitPhone(raw: string | null | undefined): { code: string; number: string } {
  const value = String(raw ?? "").trim();
  if (!value) return { code: "+20", number: "" };
  const parts = value.split(/\s+/);
  if (parts[0]?.startsWith("+") && parts.length >= 2) {
    return { code: parts[0], number: parts.slice(1).join("").replace(/\D/g, "") };
  }
  if (value.startsWith("+")) {
    const m = value.match(/^(\+\d{1,4})(\d+)$/);
    if (m) return { code: m[1]!, number: m[2]! };
  }
  return { code: "+20", number: value.replace(/\D/g, "") };
}

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { locale, setLocale } = useLocale();
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState<string>("+20");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data) {
      setName(String(profile.data.name ?? ""));
      setEmail(String(profile.data.email ?? ""));
      const split = splitPhone(typeof profile.data.phone === "string" ? profile.data.phone : "");
      setCountryCode(split.code);
      setPhone(split.number);
    }
  }, [profile.data]);

  function buildProfileUpdates(): { name?: string; email?: string; phone?: string } | null {
    const updates: { name?: string; email?: string; phone?: string } = {};
    const nextName = name.trim();
    const nextEmail = email.trim().toLowerCase();
    const digits = phone.replace(/\D/g, "");
    const existingName = String(profile.data?.name ?? "");
    const existingEmail = String(profile.data?.email ?? "").toLowerCase();
    const existingPhone = String(profile.data?.phone ?? "").trim();

    if (nextName && nextName !== existingName) updates.name = nextName;
    if (nextEmail && nextEmail !== existingEmail) updates.email = nextEmail;
    if (digits) {
      if (!/^\d{7,15}$/.test(digits)) {
        throw new Error(t("auth.register.invalidPhone"));
      }
      const composed = `${countryCode} ${digits}`;
      if (composed !== existingPhone) updates.phone = composed;
    }

    return Object.keys(updates).length ? updates : null;
  }

  const save = useMutation({
    mutationFn: (updates: { name?: string; email?: string; phone?: string }) =>
      updateProfile(updates),
    onSuccess: () => {
      setError(null);
      setInfo(t("profile.editProfile.successMessage"));
      void profile.refetch();
    },
    onError: (e: Error) => {
      setInfo(null);
      setError(e.message);
    },
  });

  const pwd = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: async () => {
      setInfo(t("profile.changePassword.successMessage"));
      await signOut();
    },
    onError: (e: Error) => setError(e.message),
  });

  async function toggleLocale() {
    const next: AppLocale = locale === "ar" ? "en" : "ar";
    await setLocale(next);
    setInfo(next.toUpperCase());
  }

  if (profile.isLoading) return <Loading />;

  return (
    <ScrollScreen>
      <PageHeader title={t("client.profile.title")} />

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { key: "profile", label: t("client.profile.tabs.profile") },
          { key: "security", label: t("client.profile.tabs.security") },
        ]}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}
      {info ? <Muted>{info}</Muted> : null}

      {tab === "profile" ? (
        <Card>
          <Label required>{t("profile.editProfile.labels.name")}</Label>
          <Field
            placeholder={t("profile.editProfile.placeholders.name")}
            value={name}
            onChangeText={setName}
          />
          <Label required>{t("profile.editProfile.labels.email")}</Label>
          <Field
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t("profile.editProfile.placeholders.email")}
            value={email}
            onChangeText={setEmail}
          />
          <Label>{t("profile.editProfile.labels.phone")}</Label>
          <View
            // Dial code sits on the start edge; `row()` mirrors it in Arabic.
            style={{ ...row(), alignItems: "flex-start", marginBottom: 12 }}
          >
            <SelectDropdown
              compact
              value={countryCode}
              options={COUNTRY_OPTIONS}
              onChange={setCountryCode}
            />
            <View style={{ flex: 1, minWidth: 0, marginStart: 8 }}>
              <Field
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 15))}
                placeholder={t("profile.editProfile.placeholders.phone")}
                style={{ marginBottom: 0 }}
              />
            </View>
          </View>
          <Muted>{t("auth.register.phoneHint")}</Muted>
          <Button
            label={
              save.isPending
                ? t("profile.editProfile.buttons.saving")
                : t("profile.editProfile.buttons.saveChanges")
            }
            onPress={() => {
              setError(null);
              setInfo(null);
              if (!name.trim()) {
                setError(t("client.newRequest.validation.requiredField"));
                return;
              }
              if (!email.trim() || !email.includes("@")) {
                setError(t("auth.register.invalidEmail"));
                return;
              }
              try {
                const updates = buildProfileUpdates();
                if (!updates) {
                  setInfo(t("profile.editProfile.successMessage"));
                  return;
                }
                save.mutate(updates);
              } catch (e) {
                setError(e instanceof Error ? e.message : t("common.error"));
              }
            }}
            disabled={save.isPending}
          />
        </Card>
      ) : (
        <Card>
          <Label>{t("profile.changePassword.labels.currentPassword")}</Label>
          <Field
            secureTextEntry
            placeholder={t("profile.changePassword.placeholders.currentPassword")}
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <Label>{t("profile.changePassword.labels.newPassword")}</Label>
          <Field
            secureTextEntry
            placeholder={t("profile.changePassword.placeholders.newPassword")}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <Muted>{t("profile.changePassword.helperText.requirements")}</Muted>
          <Label>{t("profile.changePassword.labels.confirmPassword")}</Label>
          <Field
            secureTextEntry
            placeholder={t("profile.changePassword.placeholders.confirmPassword")}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <Button
            label={
              pwd.isPending
                ? t("profile.changePassword.buttons.changing")
                : t("profile.changePassword.buttons.changePassword")
            }
            onPress={() => {
              setError(null);
              if (newPassword.length < 8) {
                setError(t("profile.changePassword.validationErrors.tooShort"));
                return;
              }
              if (newPassword !== confirmPassword) {
                setError(t("profile.changePassword.validationErrors.mismatch"));
                return;
              }
              pwd.mutate();
            }}
            variant="ghost"
            disabled={pwd.isPending}
          />
        </Card>
      )}

      <Button
        label={locale === "ar" ? "🇸🇦 العربية" : "🇺🇸 English"}
        onPress={() => void toggleLocale()}
        variant="ghost"
      />
      <Button label={t("common.logout")} onPress={() => void signOut()} variant="danger" />

      {__DEV__ ? <DevDebugCard /> : null}
    </ScrollScreen>
  );
}

function DevDebugCard() {
  const { flags, toggleFlag, dumpDiagnostics } = useDebugUi();
  return (
    <Card>
      <Muted style={{ marginBottom: 8 }}>DEV — mobile debug</Muted>
      <Button
        label={`${flags.hud ? "Hide" : "Show"} debug HUD`}
        onPress={() => toggleFlag("hud")}
        variant="ghost"
      />
      <Button
        label={`${flags.outlines ? "Disable" : "Enable"} layout outlines`}
        onPress={() => toggleFlag("outlines")}
        variant="ghost"
      />
      <Button
        label={`${flags.overflowWarn ? "Disable" : "Enable"} overflow logs`}
        onPress={() => toggleFlag("overflowWarn")}
        variant="ghost"
      />
      <Button
        label="Dump diagnostics → Metro"
        onPress={() => dumpDiagnostics()}
        variant="secondary"
      />
    </Card>
  );
}
