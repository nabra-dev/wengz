import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { changePassword, getProfile, updateProfile } from "../../src/lib/api";
import { useAuth } from "../../src/providers/auth";
import { applyLocale, t, type AppLocale } from "../../src/i18n";
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
  colors,
} from "../../src/components/ui";
import { BrandLogo } from "../../src/components/BrandLogo";
import { fonts } from "../../src/theme/brand";

type Tab = "profile" | "security";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      setPhone(String(profile.data.phone ?? ""));
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      updateProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      }),
    onSuccess: () => setInfo(t("profile.editProfile.successMessage")),
    onError: (e: Error) => setError(e.message),
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
    const { i18n } = await import("../../src/i18n");
    const locale: AppLocale = i18n.locale === "ar" ? "en" : "ar";
    await applyLocale(locale);
    setInfo(locale.toUpperCase());
  }

  if (profile.isLoading) return <Loading />;

  return (
    <ScrollScreen>
      <PageHeader title={t("client.profile.title")} description={t("client.profile.subtitle")} />
      <Card style={{ alignItems: "center", marginBottom: 16 }}>
        <BrandLogo height={28} tone="yellow" />
        <Muted style={{ marginTop: 10, marginBottom: 0 }}>
          {String(profile.data?.email ?? "")}
        </Muted>
      </Card>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        {(["profile", "security"] as Tab[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tab === key ? colors.purple : colors.card,
              borderWidth: 1,
              borderColor: tab === key ? colors.purple : colors.border,
            }}
          >
            <Text
              style={{
                color: tab === key ? colors.yellow : colors.foreground,
                fontFamily: fonts.medium,
                fontSize: 13,
              }}
            >
              {t(`client.profile.tabs.${key}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <ErrorText>{error}</ErrorText> : null}
      {info ? <Muted>{info}</Muted> : null}

      {tab === "profile" ? (
        <Card>
          <Label>{t("profile.editProfile.labels.name")}</Label>
          <Field
            placeholder={t("profile.editProfile.placeholders.name")}
            value={name}
            onChangeText={setName}
          />
          <Label>{t("profile.editProfile.labels.email")}</Label>
          <Field
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t("profile.editProfile.placeholders.email")}
            value={email}
            onChangeText={setEmail}
          />
          <Label>{t("profile.editProfile.labels.phone")}</Label>
          <Field
            value={phone}
            onChangeText={setPhone}
            placeholder={t("profile.editProfile.placeholders.phone")}
          />
          <Button
            label={
              save.isPending
                ? t("profile.editProfile.buttons.saving")
                : t("profile.editProfile.buttons.saveChanges")
            }
            onPress={() => {
              setError(null);
              if (!name.trim()) {
                setError(t("client.newRequest.validation.requiredField"));
                return;
              }
              save.mutate();
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

      <Button label={t("common.language")} onPress={() => void toggleLocale()} variant="ghost" />
      <Button label={t("common.logout")} onPress={() => void signOut()} variant="danger" />
    </ScrollScreen>
  );
}
