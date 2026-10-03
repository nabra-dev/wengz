import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Pressable, ScrollView, Text } from "react-native";
import { createRequest, getServiceTypes, uploadFile } from "../../../src/lib/api";
import { t, i18n } from "../../../src/i18n";
import {
  Button,
  ErrorText,
  Field,
  Label,
  Loading,
  Muted,
  PageHeader,
  Screen,
  colors,
} from "../../../src/components/ui";
import { fonts } from "../../../src/theme/brand";

function localizedName(item: { name?: string; nameI18n?: Record<string, string> | null }): string {
  return item.nameI18n?.[i18n.locale] || item.nameI18n?.en || item.name || "Service";
}

export default function CreateRequestScreen() {
  const qc = useQueryClient();
  const services = useQuery({ queryKey: ["service-types"], queryFn: getServiceTypes });
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const supported = useMemo(
    () => (services.data ?? []).filter((s) => s.isSupported),
    [services.data]
  );

  const create = useMutation({
    mutationFn: () =>
      createRequest({
        title: title.trim(),
        description: description.trim(),
        serviceTypeId: serviceTypeId!,
        attachments,
      }) as Promise<{ request?: { id?: string } }>,
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["requests"] });
      await qc.invalidateQueries({ queryKey: ["subscription"] });
      if (res.request?.id) router.replace(`/(app)/requests/${res.request.id}`);
      else router.back();
    },
    onError: (e: Error) => setError(e.message),
  });

  async function pickAttachment() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const url = await uploadFile(
      asset.uri,
      asset.fileName ?? "file.jpg",
      asset.mimeType ?? "image/jpeg"
    );
    setAttachments((prev) => [...prev, url]);
  }

  if (services.isLoading) return <Loading />;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader title={t("requests.create")} description={t("requests.serviceType")} />
        {error ? <ErrorText>{error}</ErrorText> : null}

        <Label>{t("requests.serviceType")}</Label>
        {supported.map((s) => {
          const selected = serviceTypeId === String(s.id);
          return (
            <Pressable
              key={String(s.id)}
              onPress={() => setServiceTypeId(String(s.id))}
              style={{
                padding: 14,
                borderRadius: 10,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: selected ? colors.yellow : colors.border,
                backgroundColor: selected ? "rgba(224,248,64,0.1)" : colors.card,
              }}
            >
              <Text
                style={{
                  color: selected ? colors.yellow : colors.foreground,
                  fontFamily: fonts.medium,
                }}
              >
                {localizedName(s as { name?: string; nameI18n?: Record<string, string> })}
              </Text>
            </Pressable>
          );
        })}
        {!supported.length ? <Muted>{t("home.noPlan")}</Muted> : null}

        <Label>{t("requests.titleLabel")}</Label>
        <Field value={title} onChangeText={setTitle} placeholder={t("requests.titleLabel")} />
        <Label>{t("requests.descriptionLabel")}</Label>
        <Field
          value={description}
          onChangeText={setDescription}
          placeholder={t("requests.descriptionLabel")}
          multiline
        />
        <Muted>{attachments.length} file(s)</Muted>
        <Button
          label={t("requests.attach")}
          onPress={() => void pickAttachment()}
          variant="ghost"
        />
        <Button
          label={create.isPending ? t("common.loading") : t("common.submit")}
          onPress={() => {
            setError(null);
            if (!serviceTypeId || !title.trim() || !description.trim()) {
              setError(t("common.error"));
              return;
            }
            create.mutate();
          }}
          disabled={create.isPending}
          variant="secondary"
        />
      </ScrollView>
    </Screen>
  );
}
