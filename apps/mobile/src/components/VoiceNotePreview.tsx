import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { t } from "../i18n";
import { getAccessToken } from "../lib/auth-store";
import { resolveMediaUrl } from "../lib/media";
import { fonts, typeScale } from "../theme/brand";
import { AppText } from "./typography";
import { colors } from "./ui";

async function loadAuthedMediaUri(remoteUrl: string): Promise<string> {
  // Local / blob URLs play directly (fresh recording preview).
  if (
    remoteUrl.startsWith("blob:") ||
    remoteUrl.startsWith("file:") ||
    remoteUrl.startsWith("data:")
  ) {
    return remoteUrl;
  }
  const token = await getAccessToken();
  const res = await fetch(resolveMediaUrl(remoteUrl), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`audio ${res.status}`);
  const blob = await res.blob();
  if (
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function" &&
    Platform.OS === "web"
  ) {
    return URL.createObjectURL(blob);
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read audio"));
    };
    reader.onerror = () => reject(new Error("Failed to read audio"));
    reader.readAsDataURL(blob);
  });
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

type Props = {
  url: string;
  /** Bubble style for chat (mine = purple tones). */
  mine?: boolean;
  onRemove?: () => void;
  disabled?: boolean;
  /** Card style for form / pending attach (default). */
  variant?: "bubble" | "card";
};

/** Playable voice note with optional remove — used in chat + VoiceRecorder. */
export function VoiceNotePreview({
  url,
  mine = false,
  onRemove,
  disabled = false,
  variant = "card",
}: Props) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  const [ready, setReady] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        const src = await loadAuthedMediaUri(url);
        if (cancelled) {
          if (src.startsWith("blob:")) URL.revokeObjectURL(src);
          return;
        }
        if (objectUrlRef.current?.startsWith("blob:")) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        objectUrlRef.current = src.startsWith("blob:") ? src : null;
        player.replace(src);
        setReady(true);
      } catch {
        if (!cancelled) setReady(false);
      }
    })();
    return () => {
      cancelled = true;
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      if (objectUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when url changes
  }, [url]);

  const progress =
    status.duration > 0 ? Math.min(1, Math.max(0, status.currentTime / status.duration)) : 0;
  const accent = mine ? colors.yellow : colors.purple;
  const labelColor = mine ? "rgba(245,247,232,0.9)" : colors.foreground;

  const body = (
    <>
      <Pressable
        onPress={() => {
          if (!ready || disabled) return;
          if (playing) player.pause();
          else {
            void (async () => {
              if (status.didJustFinish) await player.seekTo(0);
              player.play();
            })();
          }
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          flex: 1,
          minWidth: 0,
          opacity: ready ? 1 : 0.75,
        }}
        accessibilityRole="button"
        accessibilityLabel={t("requests.messages.voiceNote")}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: mine ? "rgba(0,0,0,0.18)" : "rgba(105,13,212,0.28)",
          }}
        >
          {!ready ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Ionicons name={playing ? "pause" : "play"} size={20} color={accent} />
          )}
        </View>
        <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <AppText
              style={{
                color: labelColor,
                fontFamily: fonts.medium,
                ...typeScale.sm,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {t("requests.messages.voiceNote")}
            </AppText>
            <AppText
              style={{
                color: colors.mutedForeground,
                ...typeScale.xs,
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatDuration(
                playing || status.currentTime > 0 ? status.currentTime : status.duration
              )}
            </AppText>
          </View>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: mine ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.12)",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 4,
                width: `${Math.max(4, progress * 100)}%`,
                backgroundColor: accent,
              }}
            />
          </View>
        </View>
      </Pressable>

      {onRemove && !disabled ? (
        <Pressable
          onPress={() => {
            try {
              player.pause();
            } catch {
              /* ignore */
            }
            onRemove();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("client.request.attachments.remove")}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(239,68,68,0.12)",
          }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.destructive} />
        </Pressable>
      ) : null}
    </>
  );

  if (variant === "bubble") {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minWidth: 200,
          paddingVertical: 6,
          paddingHorizontal: 4,
        }}
      >
        {body}
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.muted,
      }}
    >
      {body}
    </View>
  );
}
