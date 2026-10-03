import { useState, type ComponentProps } from "react";
import { ActivityIndicator, Pressable, View, type ViewStyle } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../i18n";
import { uploadFile } from "../lib/api";
import { isLikelyImageUrl } from "../lib/media";
import { fonts, typeScale } from "../theme/brand";
import { MediaImage } from "./MediaImage";
import { VoiceNotePreview } from "./VoiceNotePreview";
import { colors } from "./ui";
import { row, rowGap } from "../rtl";
import { debugOutlineStyle } from "../debug/outline";
import { useDebugOutlineFlags } from "../debug/outline-state";
import { OverflowProbe } from "../debug/OverflowProbe";
import { AppText } from "./typography";

function isAudioUrl(url: string) {
  return /\.(webm|m4a|mp3|ogg|wav|aac|mp4|caf|3gp)$/i.test(url.split("?")[0] ?? "");
}

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

function ActionChip({
  icon,
  label,
  onPress,
  disabled,
  style,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  disabled: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          flex: 1,
          minWidth: 0,
          ...row(),
          ...rowGap(6),
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 10,
          paddingVertical: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.foreground} />
      <AppText
        align="center"
        numberOfLines={1}
        style={{
          flexShrink: 1,
          color: colors.foreground,
          fontFamily: fonts.medium,
          ...typeScale.sm,
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
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
  const { outlines } = useDebugOutlineFlags();

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
    <OverflowProbe name="AttachmentPicker" style={{ alignSelf: "stretch" }}>
      <View
        style={[
          { gap: 10, alignSelf: "stretch" },
          debugOutlineStyle(outlines, "rgba(0,255,160,0.9)"),
        ]}
      >
        {label ? (
          <AppText
            style={{ color: colors.foreground, fontFamily: fonts.semiBold, ...typeScale.md }}
          >
            {label}
          </AppText>
        ) : null}

        {/*
          Spacer View (not marginEnd): under manual RTL we use row-reverse, and
          logical margins follow I18nManager — so marginEnd lands on the wrong side on iOS.
          Also avoid width:'100%' + gap + flex:1 (Yoga overflow).
        */}
        <View style={{ ...row(), alignItems: "stretch", alignSelf: "stretch" }}>
          <ActionChip
            icon="image-outline"
            label={t("client.request.attachments.addImages")}
            onPress={() => void pickImages()}
            disabled={blocked}
          />
          <View style={{ width: 8 }} />
          <ActionChip
            icon="document-attach-outline"
            label={t("client.request.attachments.addFiles")}
            onPress={() => void pickFiles()}
            disabled={blocked}
          />
          {busy ? (
            <>
              <View style={{ width: 8 }} />
              <ActivityIndicator color={colors.yellow} />
            </>
          ) : null}
        </View>

        {hint ? (
          <AppText style={{ color: colors.mutedForeground, ...typeScale.sm }}>{hint}</AppText>
        ) : null}
        {error ? (
          <AppText style={{ color: colors.destructive, ...typeScale.sm }}>{error}</AppText>
        ) : null}

        {(current.length > 0 || pending.length > 0) && (
          <View
            style={{
              ...row(),
              flexWrap: "wrap",
              alignSelf: "stretch",
              justifyContent: "flex-start",
              // gap avoided — Yoga overflows stretch parents that also use gap
            }}
          >
            {pending.map((p) => (
              <View
                key={p.id}
                style={{
                  width: 96,
                  marginBottom: 10,
                  marginEnd: 10,
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
                    style={{
                      width: 96,
                      height: 96,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="document-outline" size={28} color={colors.mutedForeground} />
                  </View>
                )}
                <View style={{ padding: 6, gap: 4 }}>
                  <AppText
                    compact
                    numberOfLines={1}
                    style={{ ...typeScale.xs, color: colors.mutedForeground }}
                  >
                    {p.name}
                  </AppText>
                  <ActivityIndicator size="small" color={colors.yellow} />
                </View>
              </View>
            ))}

            {current.map((url, index) => {
              const preview = localPreviews[url];
              const image = Boolean(preview) || isLikelyImageUrl(url);
              const audio = isAudioUrl(url);

              if (audio) {
                return (
                  <View key={`${url}-${index}`} style={{ width: "100%", marginBottom: 10 }}>
                    <VoiceNotePreview
                      url={url}
                      variant="card"
                      disabled={disabled}
                      onRemove={disabled ? undefined : () => removeAt(index)}
                    />
                  </View>
                );
              }

              return (
                <View
                  key={`${url}-${index}`}
                  style={{
                    width: 96,
                    marginBottom: 10,
                    marginEnd: 10,
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
                    <AppText
                      compact
                      numberOfLines={1}
                      style={{ ...typeScale.xs, color: colors.mutedForeground }}
                    >
                      {fileName(url)}
                    </AppText>
                    {!disabled ? (
                      <Pressable onPress={() => removeAt(index)} hitSlop={8}>
                        <AppText
                          compact
                          style={{
                            ...typeScale.sm,
                            color: colors.destructive,
                            fontFamily: fonts.medium,
                          }}
                        >
                          {t("client.request.attachments.remove")}
                        </AppText>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </OverflowProbe>
  );
}
