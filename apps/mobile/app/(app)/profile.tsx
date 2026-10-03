import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ScrollView } from "react-native";
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
  Screen,
} from "../../src/components/ui";
import { BrandLogo } from "../../src/components/BrandLogo";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data) {
      setName(String(profile.data.name ?? ""));
      setPhone(String(profile.data.phone ?? ""));
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      updateProfile({ name: name.trim() || undefined, phone: phone.trim() || undefined }),
    onSuccess: () => setInfo(t("profile.updated")),
    onError: (e: Error) => setError(e.message),
  });

  const pwd = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setInfo(t("profile.updated"));
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
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader title={t("profile.title")} />
        <Card style={{ alignItems: "center", marginBottom: 16 }}>
          <BrandLogo height={28} tone="yellow" />
          <Muted style={{ marginTop: 10, marginBottom: 0 }}>
            {String(profile.data?.email ?? "")}
          </Muted>
        </Card>

        {error ? <ErrorText>{error}</ErrorText> : null}
        {info ? <Muted>{info}</Muted> : null}

        <Card>
          <Label>{t("profile.name")}</Label>
          <Field value={name} onChangeText={setName} placeholder={t("profile.name")} />
          <Label>{t("profile.phone")}</Label>
          <Field value={phone} onChangeText={setPhone} placeholder="+20 1XXXXXXXXX" />
          <Button
            label={t("common.save")}
            onPress={() => {
              setError(null);
              save.mutate();
            }}
            disabled={save.isPending}
          />
        </Card>

        <Card>
          <Label>{t("profile.changePassword")}</Label>
          <Field
            secureTextEntry
            placeholder={t("profile.currentPassword")}
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <Field
            secureTextEntry
            placeholder={t("auth.newPassword")}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <Button
            label={t("profile.changePassword")}
            onPress={() => {
              setError(null);
              pwd.mutate();
            }}
            variant="ghost"
            disabled={pwd.isPending}
          />
        </Card>

        <Button label={t("common.language")} onPress={() => void toggleLocale()} variant="ghost" />
        <Button label={t("common.logout")} onPress={() => void signOut()} variant="danger" />
      </ScrollView>
    </Screen>
  );
}
