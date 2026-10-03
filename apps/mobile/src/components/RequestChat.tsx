import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { t, i18n } from "../i18n";
import { uploadFile } from "../lib/api";
import { fileNameFromUrl, isLikelyImageUrl } from "../lib/media";
import { fonts, typeScale } from "../theme/brand";
import { useAuth } from "../providers/auth";
import { AttachmentPicker } from "./AttachmentPicker";
import { MediaImage } from "./MediaImage";
import { VoiceNotePreview } from "./VoiceNotePreview";
import { AppText, AppTextInput } from "./typography";
import { isRtl, row } from "../rtl";
import { colors } from "./ui";

export type ChatComment = {
  id: string;
  content: string;
  type?: string;
  createdAt?: string;
  files?: string[];
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
};

type ThreadItem =
  | { kind: "day"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      comment: ChatComment;
      isMine: boolean;
      isSystem: boolean;
      displayName: string;
      showName: boolean;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
    };

type Props = {
  comments: ChatComment[];
  canSend: boolean;
  sending?: boolean;
  onSend: (payload: { content: string; files: string[] }) => void | Promise<void>;
  onError?: (message: string) => void;
  /** Clients see creators as Wengz (matches web). */
  maskProviderNames?: boolean;
};

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(date: Date | string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatMessageTime(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatDayLabel(date: Date | string, locale: string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameCalendarDay(d, today)) return t("requests.messages.today");
  if (sameCalendarDay(d, yesterday)) return t("requests.messages.yesterday");
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function isAudioUrl(url: string): boolean {
  return /\.(webm|m4a|mp3|ogg|wav|aac|mp4|caf|3gp)$/i.test(url.split("?")[0] ?? "");
}

function buildThread(
  comments: ChatComment[],
  myUserId: string | undefined,
  maskProviderNames: boolean
): ThreadItem[] {
  const items: ThreadItem[] = [];
  let lastDay: string | null = null;
  const locale = i18n.locale === "ar" ? "ar" : "en";

  comments.forEach((comment, index) => {
    const created = comment.createdAt || new Date().toISOString();
    const key = dayKey(created);
    if (key !== lastDay) {
      items.push({
        kind: "day",
        key: `day-${key}`,
        label: formatDayLabel(created, locale),
      });
      lastDay = key;
    }

    const isSystem = comment.type === "SYSTEM";
    const isMine = Boolean(myUserId && comment.user?.id === myUserId);

    let displayName: string;
    if (isSystem) {
      displayName = t("requests.messages.system");
    } else if (maskProviderNames && comment.user?.role === "PROVIDER") {
      displayName = t("requests.sidebar.brandProviderName");
    } else {
      displayName = comment.user?.name || comment.user?.email || "";
    }

    const prev = comments[index - 1];
    const next = comments[index + 1];
    const sameSender = (a?: ChatComment, b?: ChatComment) => {
      if (!a || !b) return false;
      if (a.type === "SYSTEM" || b.type === "SYSTEM") return false;
      return Boolean(a.user?.id && b.user?.id && a.user.id === b.user.id);
    };
    const sameDayAs = (a?: ChatComment, b?: ChatComment) =>
      Boolean(a?.createdAt && b?.createdAt && dayKey(a.createdAt) === dayKey(b.createdAt));

    const isFirstInGroup = !sameSender(prev, comment) || !sameDayAs(prev, comment);
    const isLastInGroup = !sameSender(comment, next) || !sameDayAs(comment, next);

    items.push({
      kind: "message",
      key: comment.id,
      comment,
      isMine,
      isSystem,
      displayName,
      showName: !isMine && !isSystem && isFirstInGroup,
      isFirstInGroup,
      isLastInGroup,
    });
  });

  return items;
}

function bubbleRadius(isMine: boolean, isFirst: boolean, isLast: boolean) {
  const base = 18;
  const tip = 6;
  if (isMine) {
    return {
      borderTopLeftRadius: base,
      borderBottomLeftRadius: base,
      borderTopRightRadius: isFirst ? tip : base,
      borderBottomRightRadius: isLast ? tip : 8,
    };
  }
  return {
    borderTopRightRadius: base,
    borderBottomRightRadius: base,
    borderTopLeftRadius: isFirst ? tip : base,
    borderBottomLeftRadius: isLast ? tip : 8,
  };
}

function MessageAttachment({ url, mine }: { url: string; mine: boolean }) {
  if (isAudioUrl(url)) {
    return (
      <View
        style={{
          borderRadius: 14,
          padding: 8,
          backgroundColor: mine ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.22)",
        }}
      >
        <VoiceNotePreview url={url} mine={mine} variant="bubble" />
      </View>
    );
  }

  if (isLikelyImageUrl(url)) {
    return (
      <MediaImage
        uri={url}
        zoomable
        style={{
          width: 220,
          maxWidth: "100%",
          height: 180,
          borderRadius: 12,
          backgroundColor: "rgba(0,0,0,0.2)",
        }}
      />
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: mine ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.22)",
        maxWidth: 240,
      }}
    >
      <Ionicons
        name="document-outline"
        size={18}
        color={mine ? colors.yellow : colors.foreground}
      />
      <AppText
        numberOfLines={2}
        style={{
          flex: 1,
          color: mine ? colors.foreground : colors.foreground,
          fontFamily: fonts.medium,
          ...typeScale.sm,
        }}
      >
        {fileNameFromUrl(url)}
      </AppText>
    </View>
  );
}

export function RequestChat({
  comments,
  canSend,
  sending = false,
  onSend,
  onError,
  maskProviderNames = true,
}: Props) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<Record<string, string>>({});
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  /** Uploaded voice waiting for explicit Send / Delete — never auto-sent. */
  const [voiceDraft, setVoiceDraft] = useState<string | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const webRec = useRef<MediaRecorder | null>(null);
  const webStream = useRef<MediaStream | null>(null);
  const webChunks = useRef<BlobPart[]>([]);
  const rtl = isRtl();

  const thread = useMemo(
    () => buildThread(comments, user?.id, maskProviderNames),
    [comments, user?.id, maskProviderNames]
  );
  /** Newest-first for inverted FlatList — opens pinned to the latest message. */
  const listData = useMemo(() => [...thread].reverse(), [thread]);

  const attachmentFallback = t("requests.messages.attachmentFallback");
  const hasContent = message.trim().length > 0 || pendingFiles.length > 0 || Boolean(voiceDraft);

  useEffect(() => {
    if (pendingFiles.length > 0) setShowAttach(true);
  }, [pendingFiles.length]);

  useEffect(() => {
    return () => {
      void cleanupRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  async function cleanupRecording() {
    try {
      if (audioRecorder.isRecording) await audioRecorder.stop();
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

  async function sendPayload(content: string, files: string[]) {
    const body = content.trim() || (files.length ? attachmentFallback : "");
    if (!body && files.length === 0) return;
    await onSend({ content: body, files });
    setMessage("");
    setPendingFiles([]);
    setPendingPreviews({});
    setVoiceDraft(null);
    setShowAttach(false);
  }

  async function handleSend() {
    if (sending || recording || uploadingVoice || !hasContent) return;
    try {
      const files = voiceDraft ? [...pendingFiles, voiceDraft].slice(0, 3) : pendingFiles;
      await sendPayload(message, files);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : t("requests.messages.messageFailed"));
    }
  }

  async function uploadVoiceUri(uri: string, name: string, mime: string) {
    setUploadingVoice(true);
    try {
      const url = await uploadFile(uri, name, mime);
      // Preview first — user must tap Send or delete the draft.
      setVoiceDraft(url);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : t("requests.messages.voiceAttachFailed"));
    } finally {
      setUploadingVoice(false);
      setRecording(false);
    }
  }

  async function startNativeRecord() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      onError?.(t("requests.messages.micDenied"));
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
    setRecording(true);
  }

  async function stopNativeRecord() {
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    await setAudioModeAsync({ allowsRecording: false });
    if (!uri) {
      onError?.(t("ui.voiceRecorder.emptyRecording"));
      setRecording(false);
      return;
    }
    await uploadVoiceUri(uri, `voice-${Date.now()}.m4a`, "audio/m4a");
  }

  async function startWebRecord() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onError?.(t("requests.messages.micDenied"));
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
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(webChunks.current, { type });
        if (blob.size === 0) {
          onError?.(t("ui.voiceRecorder.emptyRecording"));
          setRecording(false);
          return;
        }
        const ext = type.includes("mp4") || type.includes("m4a") ? "m4a" : "webm";
        const objectUrl = URL.createObjectURL(blob);
        try {
          await uploadVoiceUri(objectUrl, `voice-${Date.now()}.${ext}`, type);
        } finally {
          URL.revokeObjectURL(objectUrl);
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

  function stopWebRecord() {
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
    if (sending || uploadingVoice) return;
    if (recording) {
      if (Platform.OS === "web") stopWebRecord();
      else await stopNativeRecord();
      return;
    }
    if (voiceDraft || pendingFiles.length >= 3) {
      onError?.(t("requests.messages.maxAttachments"));
      return;
    }
    try {
      if (Platform.OS === "web") await startWebRecord();
      else await startNativeRecord();
    } catch {
      onError?.(t("requests.messages.micDenied"));
      setRecording(false);
    }
  }

  function renderItem({ item }: ListRenderItemInfo<ThreadItem>) {
    if (item.kind === "day") {
      return (
        <View style={{ alignItems: "center", paddingVertical: 10 }}>
          <View
            style={{
              backgroundColor: "rgba(35,28,46,0.92)",
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            <AppText
              compact
              align="center"
              style={{
                color: colors.mutedForeground,
                fontFamily: fonts.medium,
                ...typeScale.xs,
              }}
            >
              {item.label}
            </AppText>
          </View>
        </View>
      );
    }

    const { comment, isMine, isSystem, displayName, showName, isFirstInGroup, isLastInGroup } =
      item;

    if (isSystem) {
      return (
        <View style={{ alignItems: "center", paddingHorizontal: 16, paddingVertical: 6 }}>
          <View
            style={{
              maxWidth: "92%",
              backgroundColor: "rgba(35,28,46,0.9)",
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            <AppText
              compact
              align="center"
              style={{
                color: colors.mutedForeground,
                ...typeScale.xs,
                lineHeight: 16,
              }}
            >
              {comment.content}
            </AppText>
          </View>
        </View>
      );
    }

    const showText =
      Boolean(comment.content?.trim()) && comment.content.trim() !== attachmentFallback;
    const isDeliverable = comment.type === "DELIVERABLE";
    const timeLabel = comment.createdAt
      ? formatMessageTime(comment.createdAt, i18n.locale === "ar" ? "ar" : "en")
      : "";

    return (
      <View
        style={{
          ...row(),
          // WhatsApp keeps mine on the physical right even in Arabic, so the
          // own-message edge is `start` under RTL and `end` under LTR.
          justifyContent: isMine === rtl ? "flex-start" : "flex-end",
          paddingHorizontal: 10,
          marginTop: isFirstInGroup ? 10 : 2,
        }}
      >
        <View style={{ maxWidth: "82%", alignItems: isMine ? "flex-end" : "flex-start" }}>
          {showName ? (
            <AppText
              compact
              style={{
                color: "rgba(224,248,64,0.85)",
                fontFamily: fonts.medium,
                ...typeScale.xs,
                marginBottom: 3,
                paddingHorizontal: 4,
              }}
            >
              {displayName}
            </AppText>
          ) : null}

          <View
            style={{
              backgroundColor: isMine ? colors.purple : "#1F1730",
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: 6,
              borderWidth: isMine ? 0 : 1,
              borderColor: "rgba(255,255,255,0.06)",
              ...bubbleRadius(isMine, isFirstInGroup, isLastInGroup),
            }}
          >
            {isDeliverable ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: isMine ? "rgba(255,255,255,0.15)" : "rgba(224,248,64,0.15)",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  marginBottom: 6,
                }}
              >
                <AppText
                  compact
                  style={{
                    color: isMine ? colors.yellow : colors.yellow,
                    fontFamily: fonts.semiBold,
                    fontSize: 10,
                    textTransform: "uppercase",
                  }}
                >
                  {t("requests.messages.deliverable")}
                </AppText>
              </View>
            ) : null}

            {showText ? (
              <AppText
                // Keep bubble width content-sized; still pin Arabic to the right edge.
                compact
                style={{
                  color: colors.foreground,
                  fontFamily: fonts.regular,
                  fontSize: 14.5,
                  lineHeight: 21,
                }}
              >
                {comment.content}
              </AppText>
            ) : null}

            {comment.files?.length ? (
              <View style={{ gap: 8, marginTop: showText ? 8 : 0 }}>
                {comment.files.map((url, i) => (
                  <MessageAttachment key={`${comment.id}-${i}`} url={url} mine={isMine} />
                ))}
              </View>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 4,
                marginTop: 4,
              }}
            >
              <AppText
                compact
                align="right"
                style={{
                  color: isMine ? "rgba(245,247,232,0.65)" : colors.mutedForeground,
                  fontSize: 10,
                }}
              >
                {timeLabel}
              </AppText>
              {isMine ? (
                <Ionicons name="checkmark-done" size={14} color="rgba(245,247,232,0.7)" />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={listData}
        inverted
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        style={{ flex: 1, backgroundColor: "#120C1A" }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingVertical: 8,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 28,
              paddingVertical: 48,
              gap: 12,
              // inverted list flips empty state — un-flip it
              transform: [{ scaleY: -1 }],
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "rgba(105,13,212,0.18)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chatbubbles-outline" size={28} color={colors.purple} />
            </View>
            <AppText
              align="center"
              style={{
                color: colors.foreground,
                fontFamily: fonts.semiBold,
                ...typeScale.lg,
              }}
            >
              {t("requests.messages.noMessages")}
            </AppText>
            <AppText
              align="center"
              style={{
                color: colors.mutedForeground,
                ...typeScale.sm,
                maxWidth: 280,
              }}
            >
              {t("requests.messages.noMessagesHint")}
            </AppText>
          </View>
        }
      />

      {canSend ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: 8,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          {showAttach || pendingFiles.length > 0 ? (
            <View
              style={{
                marginBottom: 8,
                maxHeight: 160,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.muted,
                padding: 8,
                overflow: "hidden",
              }}
            >
              <AttachmentPicker
                value={pendingFiles}
                onChange={setPendingFiles}
                localPreviews={pendingPreviews}
                onLocalPreviewsChange={setPendingPreviews}
                max={3}
                disabled={sending || recording || uploadingVoice}
                hint={
                  pendingFiles.length
                    ? t("requests.messages.attachmentsSendHint")
                    : t("requests.messages.attach")
                }
              />
            </View>
          ) : null}

          {recording ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 8,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: "rgba(239,68,68,0.15)",
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.destructive,
                }}
              />
              <AppText
                align="center"
                style={{
                  color: colors.destructive,
                  fontFamily: fonts.medium,
                  ...typeScale.sm,
                }}
              >
                {t("requests.messages.recordingInProgress")}
              </AppText>
            </View>
          ) : null}

          {voiceDraft && !recording ? (
            <View style={{ marginBottom: 8, gap: 6 }}>
              <AppText
                style={{
                  color: colors.mutedForeground,
                  fontFamily: fonts.medium,
                  ...typeScale.xs,
                }}
              >
                {t("requests.messages.voiceAttachedHint")}
              </AppText>
              <VoiceNotePreview
                url={voiceDraft}
                variant="card"
                disabled={sending || uploadingVoice}
                onRemove={sending || uploadingVoice ? undefined : () => setVoiceDraft(null)}
              />
            </View>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 6,
            }}
          >
            <Pressable
              onPress={() => setShowAttach((v) => !v)}
              disabled={sending || recording || uploadingVoice}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  showAttach || pendingFiles.length > 0 ? "rgba(105,13,212,0.2)" : "transparent",
                opacity: sending || recording || uploadingVoice ? 0.5 : 1,
              }}
              accessibilityLabel={t("requests.messages.attach")}
            >
              <Ionicons
                name="attach"
                size={22}
                color={
                  showAttach || pendingFiles.length > 0 ? colors.purple : colors.mutedForeground
                }
              />
            </Pressable>

            <View
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 120,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.muted,
                paddingHorizontal: 14,
                paddingVertical: Platform.OS === "ios" ? 10 : 6,
                justifyContent: "center",
              }}
            >
              <AppTextInput
                value={message}
                onChangeText={setMessage}
                placeholder={t("requests.messages.placeholder")}
                placeholderTextColor={colors.mutedForeground}
                editable={!sending && !recording}
                multiline
                style={{
                  color: colors.foreground,
                  fontFamily: fonts.regular,
                  fontSize: 15,
                  lineHeight: 20,
                  maxHeight: 100,
                  padding: 0,
                  margin: 0,
                }}
              />
            </View>

            {hasContent ? (
              <Pressable
                onPress={() => void handleSend()}
                disabled={sending || recording || uploadingVoice}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.purple,
                  opacity: sending || recording || uploadingVoice ? 0.6 : 1,
                }}
                accessibilityLabel={t("requests.messages.send")}
              >
                {sending ? (
                  <ActivityIndicator color={colors.yellow} />
                ) : (
                  <Ionicons
                    name="send"
                    size={18}
                    color={colors.yellow}
                    style={{ marginStart: 2 }}
                  />
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void toggleRecord()}
                disabled={sending || uploadingVoice}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: recording ? "rgba(239,68,68,0.2)" : "transparent",
                  opacity: sending || uploadingVoice ? 0.5 : 1,
                }}
                accessibilityLabel={
                  recording
                    ? t("requests.messages.stopRecording")
                    : t("requests.messages.recordVoice")
                }
              >
                {uploadingVoice ? (
                  <ActivityIndicator color={colors.yellow} />
                ) : (
                  <Ionicons
                    name={recording ? "stop" : "mic"}
                    size={22}
                    color={recording ? colors.destructive : colors.mutedForeground}
                  />
                )}
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: colors.card,
          }}
        >
          <AppText
            align="center"
            style={{
              color: colors.mutedForeground,
              ...typeScale.sm,
            }}
          >
            {t("requests.messages.requestCompleted")}
          </AppText>
        </View>
      )}
    </View>
  );
}
