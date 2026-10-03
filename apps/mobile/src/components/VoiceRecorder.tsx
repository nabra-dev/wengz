import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../i18n";
import { uploadFile } from "../lib/api";
import { fileNameFromUrl } from "../lib/media";
import { fonts, typeScale } from "../theme/brand";
import { colors } from "./ui";
import { AppText } from "./typography";

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
};

function isAudioName(name: string) {
  return /\.(webm|m4a|mp3|ogg|wav|aac|mp4|caf|3gp)$/i.test(name);
}

export function VoiceRecorder({
  value,
  onChange,
  maxFiles = 1,
  maxSizeMB = 25,
  disabled = false,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const webRec = useRef<MediaRecorder | null>(null);
  const webStream = useRef<MediaStream | null>(null);
  const webChunks = useRef<BlobPart[]>([]);

  useEffect(() => {
    return () => {
      void cleanupRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  async function cleanupRecording() {
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }
    } catch {
      /* ignore */
    }
    if (webRec.current && webRec.current.state !== "inactive") {
      try {
        webRec.current.stop();
      } catch {
        /* ignore */
      }
    }
    webRec.current = null;
    webStream.current?.getTracks().forEach((tr) => tr.stop());
    webStream.current = null;
    webChunks.current = [];
  }

  async function uploadUri(uri: string, name: string, mime: string) {
    const url = await uploadFile(uri, name, mime);
    onChange(maxFiles === 1 ? [url] : [...value, url].slice(0, maxFiles));
  }

  async function uploadWebBlob(blob: Blob, name: string) {
    if (blob.size === 0) {
      setError(t("ui.voiceRecorder.emptyRecording"));
      return;
    }
    if (blob.size > maxSizeMB * 1024 * 1024) {
      setError(t("ui.voiceRecorder.fileTooLargeDesc", { maxSize: maxSizeMB }));
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    try {
      await uploadUri(objectUrl, name, blob.type || "audio/webm");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function startNative() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError(t("ui.voiceRecorder.micDenied"));
      return;
    }
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
    setRecording(true);
  }

  async function stopNative() {
    setUploading(true);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      await setAudioModeAsync({ allowsRecording: false });
      if (!uri) {
        setError(t("ui.voiceRecorder.emptyRecording"));
        return;
      }
      await uploadUri(uri, `voice-${Date.now()}.m4a`, "audio/m4a");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ui.voiceRecorder.uploadFailed"));
    } finally {
      setUploading(false);
      setRecording(false);
    }
  }

  async function startWeb() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(t("ui.voiceRecorder.micDenied"));
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    webChunks.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) webChunks.current.push(e.data);
    };
    mr.onstop = () => {
      void (async () => {
        setUploading(true);
        try {
          const type = mr.mimeType || "audio/webm";
          const blob = new Blob(webChunks.current, { type });
          const ext = type.includes("mp4") || type.includes("m4a") ? "m4a" : "webm";
          await uploadWebBlob(blob, `voice-${Date.now()}.${ext}`);
        } catch (e) {
          setError(e instanceof Error ? e.message : t("ui.voiceRecorder.uploadFailed"));
        } finally {
          setUploading(false);
          setRecording(false);
          webStream.current?.getTracks().forEach((tr) => tr.stop());
          webStream.current = null;
          webRec.current = null;
          webChunks.current = [];
        }
      })();
    };
    webStream.current = stream;
    webRec.current = mr;
    mr.start(250);
    setRecording(true);
  }

  function stopWeb() {
    const mr = webRec.current;
    if (!mr || mr.state === "inactive") return;
    try {
      mr.requestData?.();
    } catch {
      /* ignore */
    }
    mr.stop();
  }

  async function toggleRecord() {
    if (disabled || uploading) return;
    setError(null);
    if (recording) {
      if (Platform.OS === "web") stopWeb();
      else await stopNative();
      return;
    }
    if (value.length >= maxFiles) {
      setError(t("ui.voiceRecorder.maximumFilesReached"));
      return;
    }
    try {
      if (Platform.OS === "web") await startWeb();
      else await startNative();
    } catch {
      setError(t("ui.voiceRecorder.micDenied"));
      setRecording(false);
      await cleanupRecording();
    }
  }

  async function pickAudio() {
    if (disabled || uploading || recording || value.length >= maxFiles) return;
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      multiple: maxFiles > 1,
      copyToCacheDirectory: true,
      type: ["audio/*"],
    });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      const remaining = maxFiles - value.length;
      const urls = [...value];
      for (const asset of result.assets.slice(0, remaining)) {
        const name = asset.name || fileNameFromUrl(asset.uri);
        if (!isAudioName(name) && !asset.mimeType?.startsWith("audio/")) {
          setError(t("ui.voiceRecorder.invalidFileTypeDesc", { filename: name }));
          continue;
        }
        const url = await uploadFile(asset.uri, name, asset.mimeType || "audio/mpeg");
        urls.push(url);
      }
      onChange(urls.slice(0, maxFiles));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ui.voiceRecorder.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const busy = disabled || uploading;
  const atLimit = value.length >= maxFiles;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          onPress={() => void toggleRecord()}
          disabled={busy || (!recording && atLimit)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: recording ? colors.destructive : colors.border,
            backgroundColor: recording ? "rgba(239,68,68,0.12)" : colors.card,
            opacity: busy || (!recording && atLimit) ? 0.5 : 1,
          }}
        >
          <Ionicons
            name={recording ? "stop" : "mic"}
            size={18}
            color={recording ? colors.destructive : colors.foreground}
          />
          <AppText
            style={{
              color: recording ? colors.destructive : colors.foreground,
              fontFamily: fonts.medium,
              ...typeScale.sm,
            }}
          >
            {recording ? t("ui.voiceRecorder.stop") : t("ui.voiceRecorder.record")}
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => void pickAudio()}
          disabled={busy || recording || atLimit}
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
            opacity: busy || recording || atLimit ? 0.5 : 1,
          }}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={colors.foreground} />
          <AppText style={{ color: colors.foreground, fontFamily: fonts.medium, ...typeScale.sm }}>
            {t("ui.voiceRecorder.uploadAudio")}
          </AppText>
        </Pressable>

        {uploading ? <ActivityIndicator color={colors.yellow} /> : null}
      </View>

      {recording ? (
        <AppText style={{ color: colors.destructive, ...typeScale.sm }}>
          {t("requests.messages.recordingInProgress")}
        </AppText>
      ) : null}

      <AppText style={{ color: colors.mutedForeground, ...typeScale.xs }}>
        {t("ui.voiceRecorder.hint", { maxSize: maxSizeMB, maxFiles })}
      </AppText>

      {error ? (
        <AppText style={{ color: colors.destructive, ...typeScale.sm }}>{error}</AppText>
      ) : null}

      {value.map((url, index) => (
        <View
          key={`${url}-${index}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.muted,
          }}
        >
          <Ionicons name="musical-notes-outline" size={20} color={colors.yellow} />
          <AppText
            numberOfLines={1}
            style={{
              flex: 1,
              color: colors.foreground,
              fontFamily: fonts.regular,
              ...typeScale.sm,
            }}
          >
            {fileNameFromUrl(url)}
          </AppText>
          {!disabled && !recording ? (
            <Pressable onPress={() => removeAt(index)} hitSlop={8}>
              <AppText
                style={{ color: colors.destructive, fontFamily: fonts.medium, ...typeScale.sm }}
              >
                {t("client.request.attachments.remove")}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
