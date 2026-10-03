import { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { uploadFile } from "../lib/api";
import { isLikelyImageUrl, resolveMediaUrl } from "../lib/media";
import { t } from "../i18n";
import { fonts } from "../theme/brand";
import { Label, Muted, colors } from "./ui";

type Props = {
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  disabled?: boolean;
  label?: string;
  /** When true, picking replaces the first item (payment receipt). */
  single?: boolean;
  hint?: string;
};

const TILE = 96;

export function AttachmentPicker({
  urls,
  onChange,
  max = 5,
  disabled,
  label,
  single = false,
  hint,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const limit = single ? 1 : max;
  const canAdd = !disabled && !uploading && (single || urls.length < limit);

  async function pick() {
    if (!canAdd) return;
    setError(null);
    const remaining = single ? 1 : Math.max(1, limit - urls.length);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: !single && remaining > 1,
      selectionLimit: remaining,
    });
    if (picked.canceled || !picked.assets?.length) return;

    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const asset of picked.assets) {
        if (uploaded.length >= remaining) break;
        const url = await uploadFile(
          asset.uri,
          asset.fileName ?? `file-${Date.now()}.jpg`,
          asset.mimeType ?? "image/jpeg"
        );
        uploaded.push(url);
      }
      onChange(single ? uploaded.slice(0, 1) : [...urls, ...uploaded].slice(0, limit));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("profile.editProfile.uploadMessages.failed"));
    } finally {
      setUploading(false);
    }
  }

  function removeAt(index: number) {
    onChange(urls.filter((_, i) => i !== index));
  }

  return (
    <View style={{ marginBottom: 8 }}>
      {label ? <Label>{label}</Label> : null}
      <Muted>
        {hint || `${urls.length}/${limit}`}
        {uploading ? ` · ${t("profile.editProfile.buttons.uploading")}` : ""}
      </Muted>
      {error ? (
        <Text style={{ color: colors.destructive, fontFamily: fonts.regular, marginBottom: 8 }}>
          {error}
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
      >
        {urls.map((url, index) => {
          const src = resolveMediaUrl(url);
          const image = isLikelyImageUrl(url) || url.startsWith("file:");
          return (
            <View key={`${url}-${index}`} style={{ width: TILE }}>
              <Pressable
                onPress={() => image && setPreview(src)}
                style={{
                  width: TILE,
                  height: TILE,
                  borderRadius: 10,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.muted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {image ? (
                  <Image
                    source={{ uri: src }}
                    style={{ width: TILE, height: TILE }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="document-outline" size={28} color={colors.mutedForeground} />
                )}
              </Pressable>
              {!disabled ? (
                <Pressable
                  onPress={() => removeAt(index)}
                  hitSlop={8}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: colors.destructive,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: colors.background,
                  }}
                  accessibilityLabel={t("profile.editProfile.buttons.removePhoto")}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              ) : null}
              <Text
                numberOfLines={1}
                style={{
                  color: colors.mutedForeground,
                  fontSize: 10,
                  fontFamily: fonts.regular,
                  marginTop: 4,
                }}
              >
                {url.split("/").pop()}
              </Text>
            </View>
          );
        })}

        {canAdd || uploading ? (
          <Pressable
            disabled={!canAdd}
            onPress={() => void pick()}
            style={{
              width: TILE,
              height: TILE,
              borderRadius: 10,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: uploading ? colors.purple : colors.border,
              backgroundColor: "rgba(105,13,212,0.08)",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {uploading ? (
              <ActivityIndicator color={colors.yellow} />
            ) : (
              <>
                <Ionicons name="image-outline" size={26} color={colors.yellow} />
                <Text
                  style={{
                    color: colors.yellow,
                    fontFamily: fonts.medium,
                    fontSize: 11,
                    textAlign: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  {t("profile.editProfile.buttons.uploadPhoto")}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={Boolean(preview)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <Pressable
          onPress={() => setPreview(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
          }}
        >
          {preview ? (
            <Image
              source={{ uri: preview }}
              style={{ width: "100%", height: "75%", borderRadius: 12 }}
              resizeMode="contain"
            />
          ) : null}
          <Pressable
            onPress={() => setPreview(null)}
            style={{
              marginTop: 20,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 8,
              backgroundColor: colors.yellow,
            }}
          >
            <Text style={{ color: "#2A0A55", fontFamily: fonts.semiBold }}>{t("common.back")}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
