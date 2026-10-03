import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../i18n";
import { uploadFile } from "../lib/api";
import { isLikelyImageUrl } from "../lib/media";
import { fonts } from "../theme/brand";
import { MediaImage } from "./MediaImage";
import { colors } from "./ui";

type Pending = {
  id: string;
  localUri: string;
  name: string;
  isImage: boolean;
};

type Props = {
  value?: string[];
  /** @deprecated use `value` */
  urls?: string[];
  onChange: (urls: string[]) => void;
  localPreviews?: Record<string, string>;
  onLocalPreviewsChange?: (next: Record<string, string>) => void;
  label?: string;
  hint?: string;
  max?: number;
  single?: boolean;
  disabled?: boolean;
};

function fileName(uri: string) {
  try {
    const path = uri.split("?")[0] ?? uri;
    return decodeURIComponent(path.split("/").pop() || "file");
  } catch {
    return "file";
  }
}

export function AttachmentPicker({
  value,
  urls,
  onChange,
  localPreviews = {},
  onLocalPreviewsChange,
  label,
  hint,
  max = 10,
  single = false,
  disabled = false,
}: Props) {
  const current = value ?? urls ?? [];
  const limit = single ? 1 : max;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);

  const remaining = Math.max(0, limit - current.length - pending.length);
  const blocked = disabled || busy || remaining <= 0;

  async function addUploads(
    assets: Array<{ uri: string; name: string; mimeType?: string | null; isImage: boolean }>
  ) {
    if (!assets.length || remaining <= 0 || disabled) return;
    const slice = assets.slice(0, remaining);
    const pendingItems: Pending[] = slice.map((a, i) => ({
      id: `${Date.now()}-${i}`,
      localUri: a.uri,
      name: a.name,
      isImage: a.isImage,
    }));
    setPending((prev) => [...prev, ...pendingItems]);
    setBusy(true);
    setError(null);
    const uploaded: string[] = [];
    const previewMap = { ...localPreviews };
    try {
      for (let i = 0; i < slice.length; i++) {
        const asset = slice[i]!;
        const item = pendingItems[i]!;
        const url = await uploadFile(
          asset.uri,
          asset.name,
          asset.mimeType || "application/octet-stream"
        );
        uploaded.push(url);
        if (asset.isImage) previewMap[url] = asset.uri;
        setPending((prev) => prev.filter((p) => p.id !== item.id));
      }
      onLocalPreviewsChange?.(previewMap);
      onChange(single ? uploaded.slice(-1) : [...current, ...uploaded]);
    } catch (e) {
      setPending((prev) => prev.filter((p) => !pendingItems.some((x) => x.id === p.id)));
      setError(e instanceof Error ? e.message : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function pickImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(t("client.request.attachments.permissionDenied"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: !single,
      quality: 0.85,
      selectionLimit: remaining || 1,
    });
    if (result.canceled || !result.assets?.length) return;
    await addUploads(
      result.assets.map((a, i) => ({
        uri: a.uri,
        name: a.fileName || `image-${Date.now()}-${i}.jpg`,
        mimeType: a.mimeType || "image/jpeg",
        isImage: true,
      }))
    );
  }

  async function pickFiles() {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: !single,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    await addUploads(
      result.assets.map((a) => ({
        uri: a.uri,
        name: a.name || fileName(a.uri),
        mimeType: a.mimeType,
        isImage: Boolean(a.mimeType?.startsWith("image/") || isLikelyImageUrl(a.name || a.uri)),
      }))
    );
  }

  function removeAt(index: number) {
    const url = current[index];
    if (!url) return;
    onChange(current.filter((_, i) => i !== index));
    if (localPreviews[url]) {
      const next = { ...localPreviews };
      delete next[url];
      onLocalPreviewsChange?.(next);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      {label ? (
        <Text style={{ color: colors.foreground, fontFamily: fonts.semiBold, fontSize: 14 }}>
          {label}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          onPress={() => void pickImages()}
          disabled={blocked}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            opacity: blocked ? 0.5 : 1,
          }}
        >
          <Ionicons name="image-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: fonts.medium, fontSize: 13 }}>
            {t("client.request.attachments.addImages")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void pickFiles()}
          disabled={blocked}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            opacity: blocked ? 0.5 : 1,
          }}
        >
          <Ionicons name="document-attach-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: fonts.medium, fontSize: 13 }}>
            {t("client.request.attachments.addFiles")}
          </Text>
        </Pressable>
        {busy ? <ActivityIndicator color={colors.yellow} style={{ marginLeft: 4 }} /> : null}
      </View>

      {hint ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{hint}</Text> : null}
      {error ? <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text> : null}

      {(current.length > 0 || pending.length > 0) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {pending.map((p) => (
            <View
              key={p.id}
              style={{
                width: 96,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.muted,
                overflow: "hidden",
                opacity: 0.85,
              }}
            >
              {p.isImage ? (
                <MediaImage
                  uri={p.localUri}
                  previewUri={p.localUri}
                  style={{ width: 96, height: 96 }}
                />
              ) : (
                <View
                  style={{ width: 96, height: 96, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="document-outline" size={28} color={colors.mutedForeground} />
                </View>
              )}
              <View style={{ padding: 6, gap: 4 }}>
                <Text numberOfLines={1} style={{ fontSize: 10, color: colors.mutedForeground }}>
                  {p.name}
                </Text>
                <ActivityIndicator size="small" color={colors.yellow} />
              </View>
            </View>
          ))}

          {current.map((url, index) => {
            const preview = localPreviews[url];
            const image = Boolean(preview) || isLikelyImageUrl(url);
            return (
              <View
                key={`${url}-${index}`}
                style={{
                  width: 96,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  overflow: "hidden",
                }}
              >
                {image ? (
                  <MediaImage
                    uri={url}
                    previewUri={preview}
                    zoomable
                    style={{ width: 96, height: 96 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 96,
                      height: 96,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.muted,
                    }}
                  >
                    <Ionicons name="document-outline" size={28} color={colors.mutedForeground} />
                  </View>
                )}
                <View style={{ padding: 6, gap: 4 }}>
                  <Text numberOfLines={1} style={{ fontSize: 10, color: colors.mutedForeground }}>
                    {fileName(url)}
                  </Text>
                  {!disabled ? (
                    <Pressable onPress={() => removeAt(index)} hitSlop={8}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.destructive,
                          fontFamily: fonts.medium,
                        }}
                      >
                        {t("client.request.attachments.remove")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
