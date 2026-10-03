import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAccessToken } from "../lib/auth-store";
import { isLikelyImageUrl, resolveMediaUrl } from "../lib/media";
import { fonts } from "../theme/brand";
import { colors } from "./ui";
import { t } from "../i18n";

type Props = {
  uri: string;
  /** Prefer local file:// / data: for instant preview after pick. */
  previewUri?: string | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  /** Tap opens full-screen lightbox. */
  zoomable?: boolean;
};

async function loadAuthedDataUri(remoteUrl: string): Promise<string> {
  const url = resolveMediaUrl(remoteUrl);
  const token = await getAccessToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Image ${res.status}`);
  }
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read image"));
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

/** Image that works for local picks and auth-protected `/api/files/...` URLs. */
export function MediaImage({
  uri,
  previewUri,
  style,
  resizeMode = "cover",
  zoomable = false,
}: Props) {
  const local =
    previewUri ||
    (uri.startsWith("file:") || uri.startsWith("data:") || uri.startsWith("blob:") ? uri : null);
  const [remoteSrc, setRemoteSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(!local);
  const [lightbox, setLightbox] = useState(false);

  const treatAsImage = Boolean(local) || isLikelyImageUrl(uri);

  useEffect(() => {
    if (local) {
      setLoading(false);
      setFailed(false);
      return;
    }
    if (!treatAsImage) {
      setLoading(false);
      setFailed(false);
      setRemoteSrc(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setRemoteSrc(null);
    void loadAuthedDataUri(uri)
      .then((dataUri) => {
        if (!cancelled) {
          setRemoteSrc(dataUri);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uri, local, treatAsImage]);

  const src = local || remoteSrc;
  const showImage = Boolean(src) && !failed && treatAsImage;

  const body = (
    <View style={[{ alignItems: "center", justifyContent: "center", overflow: "hidden" }, style]}>
      {loading ? <ActivityIndicator color={colors.yellow} /> : null}
      {!loading && showImage && src ? (
        <Image
          source={{ uri: src }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          resizeMode={resizeMode}
        />
      ) : null}
      {!loading && (!showImage || failed) ? (
        <Ionicons name="document-outline" size={28} color={colors.mutedForeground} />
      ) : null}
    </View>
  );

  if (!zoomable || !src || !showImage) return body;

  return (
    <>
      <Pressable onPress={() => setLightbox(true)}>{body}</Pressable>
      <Modal
        visible={lightbox}
        transparent
        animationType="fade"
        onRequestClose={() => setLightbox(false)}
      >
        <Pressable
          onPress={() => setLightbox(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
          }}
        >
          <Image
            source={{ uri: src }}
            style={{ width: "100%", height: "75%", borderRadius: 12 }}
            resizeMode="contain"
          />
          <Pressable
            onPress={() => setLightbox(false)}
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
    </>
  );
}

export function MediaThumbGrid({
  urls,
  previews,
}: {
  urls: string[];
  previews?: Record<string, string>;
}) {
  if (!urls.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {urls.map((url, i) => (
        <MediaImage
          key={`${url}-${i}`}
          uri={url}
          previewUri={previews?.[url]}
          zoomable
          style={{
            width: 88,
            height: 88,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.muted,
          }}
        />
      ))}
    </View>
  );
}
