/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InlineFileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { AudioPlayer } from "@/components/ui/audio-player";
import {
  Send,
  Mic,
  Square,
  FileIcon,
  FileText,
  FileArchive,
  FileAudio,
  FileVideo,
  ExternalLink,
  Loader2,
  MessageSquare,
  Paperclip,
  CheckCheck,
} from "lucide-react";
import { showError } from "@/lib/error-handler";
import { ContactPolicyNotice } from "@/components/ui/contact-policy-notice";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { textHasContactLeak } from "@/lib/contact-leak";
import { cn, getInitials } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { useTranslations, useLocale } from "next-intl";
import { pickSupportedAudioMime } from "@/lib/audio-recording";
import { normalizeUploadMime, resolveUploadMime } from "@/lib/upload-limits";
import {
  filenameFromUrl,
  prettyFilename,
  resolveFileKind,
  type FileKind,
} from "@/lib/file-display";

interface Comment {
  id: string;
  type: string;
  content: string;
  createdAt: Date;
  user: {
    id?: string | null;
    name: string | null;
    email: string | null;
    image: string | null;
    role?: string | null;
  };
  files: string[];
}

interface MessagesCardProps {
  readonly requestId: string;
  readonly comments: Comment[];
  readonly title?: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly canSendMessages?: boolean;
  readonly maskProviderNames?: boolean;
  readonly maskClientNames?: boolean;
  /** Tall chat panel for split request layouts. */
  readonly variant?: "default" | "panel";
}

type ThreadItem =
  | { kind: "day"; key: string; label: string }
  | {
      kind: "message";
      comment: Comment;
      isMine: boolean;
      isSystem: boolean;
      displayName: string;
      displayImage: string | null;
      showAvatar: boolean;
      showName: boolean;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
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

function formatDayLabel(date: Date | string, locale: string, t: (key: string) => string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameCalendarDay(d, today)) return t("today");
  if (sameCalendarDay(d, yesterday)) return t("yesterday");
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function KindGlyph({ kind }: { readonly kind: FileKind }) {
  const cls = "h-5 w-5";
  switch (kind) {
    case "audio":
      return <FileAudio className={cls} />;
    case "video":
      return <FileVideo className={cls} />;
    case "pdf":
      return <FileText className={cls} />;
    case "archive":
      return <FileArchive className={cls} />;
    default:
      return <FileIcon className={cls} />;
  }
}

function labelForFileUrl(url: string, kind: FileKind, t: (key: string) => string): string {
  const raw = filenameFromUrl(url);
  const pretty = prettyFilename(raw);
  if (kind === "audio") return t("voiceNote");
  if (pretty && !pretty.startsWith(".")) return pretty;
  const ext = raw.includes(".") ? raw.split(".").pop() : "";
  const base = kind === "image" ? t("image") : kind === "video" ? t("video") : t("file");
  return ext ? `${base}.${ext}` : base;
}

function MessageFileAttachment({ url, mine }: { readonly url: string; readonly mine?: boolean }) {
  const t = useTranslations("requests.messages");
  const kind = resolveFileKind(url);
  const name = labelForFileUrl(url, kind, t);

  if (kind === "audio") {
    return (
      <div
        className={cn(
          "w-full max-w-[min(100%,18rem)] space-y-1.5 rounded-2xl p-2.5 sm:max-w-xs",
          mine ? "bg-black/15" : "bg-black/20"
        )}
      >
        <div className="flex items-center gap-2 text-[11px] opacity-80">
          <FileAudio className="h-3.5 w-3.5" />
          <span>{t("voiceNote")}</span>
        </div>
        <AudioPlayer src={url} filename={name} className="w-full" />
      </div>
    );
  }

  if (kind === "image") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full max-w-[min(100%,15rem)] overflow-hidden rounded-xl sm:max-w-[17rem]"
      >
        <img src={url} alt={name} className="max-h-56 w-full object-cover bg-black/20" />
      </a>
    );
  }

  if (kind === "video") {
    return (
      <div className="w-full max-w-[min(100%,18rem)] overflow-hidden rounded-xl sm:max-w-xs">
        <video src={url} controls className="max-h-56 w-full bg-black/20" title={name}>
          <track kind="captions" />
        </video>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm",
        mine ? "bg-black/15 hover:bg-black/25" : "bg-black/20 hover:bg-black/30"
      )}
    >
      <KindGlyph kind={kind} />
      <span className="truncate font-medium">{name}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  );
}

function buildThread(
  comments: Comment[],
  myUserId: string | undefined,
  locale: string,
  t: (key: string) => string,
  tSidebar: (key: string) => string,
  maskProviderNames: boolean,
  maskClientNames: boolean
): ThreadItem[] {
  const items: ThreadItem[] = [];
  let lastDay: string | null = null;

  comments.forEach((threadComment, index) => {
    const key = dayKey(threadComment.createdAt);
    if (key !== lastDay) {
      items.push({
        kind: "day",
        key: `day-${key}`,
        label: formatDayLabel(threadComment.createdAt, locale, t),
      });
      lastDay = key;
    }

    const isSystem = threadComment.type === "SYSTEM";
    const isMine = Boolean(myUserId && threadComment.user?.id === myUserId);

    let displayName: string;
    let displayImage: string | null = null;
    if (isSystem) {
      displayName = t("system");
    } else if (maskProviderNames && threadComment.user?.role === "PROVIDER") {
      displayName = tSidebar("brandProviderName");
      displayImage = "/images/logo.svg";
    } else if (maskClientNames && threadComment.user?.role === "CLIENT") {
      displayName = tSidebar("brandClientName");
    } else {
      displayName = threadComment.user.name || threadComment.user.email || "";
      displayImage = threadComment.user.image || null;
    }

    const prev = comments[index - 1];
    const next = comments[index + 1];
    const sameSender = (a?: Comment, b?: Comment) => {
      if (!a || !b) return false;
      if (a.type === "SYSTEM" || b.type === "SYSTEM") return false;
      return a.user?.id && b.user?.id && a.user.id === b.user.id;
    };
    const sameDayAs = (a?: Comment, b?: Comment) =>
      Boolean(a && b && dayKey(a.createdAt) === dayKey(b.createdAt));

    const isFirstInGroup = !sameSender(prev, threadComment) || !sameDayAs(prev, threadComment);
    const isLastInGroup = !sameSender(threadComment, next) || !sameDayAs(threadComment, next);

    items.push({
      kind: "message",
      comment: threadComment,
      isMine,
      isSystem,
      displayName,
      displayImage,
      showAvatar: !isMine && !isSystem && isLastInGroup,
      showName: !isMine && !isSystem && isFirstInGroup,
      isFirstInGroup,
      isLastInGroup,
    });
  });

  return items;
}

export function MessagesCard({
  requestId,
  comments,
  title = "Messages",
  description = "Communicate with other parties",
  placeholder = "Type your message...",
  canSendMessages = true,
  maskProviderNames = false,
  maskClientNames = false,
  variant = "default",
}: MessagesCardProps) {
  const t = useTranslations("requests.messages");
  const tSidebar = useTranslations("requests.sidebar");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const { data: session } = useSession();
  const myUserId = session?.user?.id;
  const [comment, setComment] = useState("");
  const [commentFiles, setCommentFiles] = useState<UploadedFile[]>([]);
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previousLastCommentIdRef = useRef<string | null>(null);

  const utils = trpc.useUtils();

  const thread = useMemo(
    () => buildThread(comments, myUserId, locale, t, tSidebar, maskProviderNames, maskClientNames),
    [comments, myUserId, locale, t, tSidebar, maskProviderNames, maskClientNames]
  );

  useEffect(() => {
    const handleThreadUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ notification?: { type?: string }; link?: string }>)
        .detail;
      const notificationType = detail?.notification?.type;
      const link = detail?.link ?? "";
      const isThreadEvent = notificationType === "message" || notificationType === "status_change";
      const isCurrentRequest = link.includes(`/requests/${requestId}`);

      if (!isThreadEvent || !isCurrentRequest) {
        return;
      }

      void utils.request.getById.invalidate({ id: requestId });
    };

    globalThis.addEventListener("wengz:request-thread-updated", handleThreadUpdate);
    return () => globalThis.removeEventListener("wengz:request-thread-updated", handleThreadUpdate);
  }, [requestId, utils.request.getById]);

  const addComment = trpc.request.addComment.useMutation({
    onSuccess: () => {
      setComment("");
      setCommentFiles([]);
      setShowAttach(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      utils.request.getById.invalidate({ id: requestId });
    },
    onError: (error: unknown) => {
      showError(error, t("messageFailed"));
    },
  });

  const handleSendComment = () => {
    const hasContent = comment.trim().length > 0 || commentFiles.length > 0;
    if (!hasContent || addComment.isPending || isRecording || isUploadingVoice) return;
    if (comment.trim() && textHasContactLeak(comment.trim(), "strict")) {
      toast.error(tErrors("contactNotAllowed"));
      return;
    }
    addComment.mutate({
      requestId,
      content: comment.trim() || t("attachmentFallback"),
      files: commentFiles.map((f) => f.url),
    });
  };

  const uploadBlobAsFile = async (blob: Blob, filename: string, type: string) => {
    const mime = resolveUploadMime(type, filename) || type;
    const formData = new FormData();
    const file = new File([blob], filename, { type: mime });
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "Upload failed");
    }
    const data = await res.json();
    return {
      url: data.url as string,
      filename: data.filename as string,
      size: data.size as number,
      type: data.type as string,
    } satisfies UploadedFile;
  };

  const releaseMic = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    if (isRecording || isUploadingVoice || addComment.isPending) return;
    if (commentFiles.length >= 3) {
      toast.error(t("maxAttachments"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const picked = pickSupportedAudioMime();
      const mediaRecorder = picked.mimeType
        ? new MediaRecorder(stream, { mimeType: picked.mimeType })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        setIsUploadingVoice(true);
        const blobType =
          normalizeUploadMime(mediaRecorder.mimeType) || picked.fileType || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });
        try {
          if (blob.size === 0) throw new Error("Empty recording");
          const uploaded = await uploadBlobAsFile(
            blob,
            `voice-note-${Date.now()}.${picked.extension}`,
            blobType
          );
          setCommentFiles((prev) => [...prev, uploaded]);
          setShowAttach(true);
        } catch (e) {
          showError(e, t("voiceAttachFailed"));
        } finally {
          setIsUploadingVoice(false);
          setIsRecording(false);
          releaseMic();
        }
      };
      mediaRecorderRef.current = mediaRecorder;
      streamRef.current = stream;
      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (e) {
      showError(e, t("micDenied"));
      setIsRecording(false);
      releaseMic();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.requestData();
      } catch {
        // older browsers may not support requestData
      }
      mediaRecorderRef.current.stop();
    }
  };

  const hasContentForSend = comment.trim().length > 0 || commentFiles.length > 0;
  const sendDisabled =
    !hasContentForSend || addComment.isPending || isRecording || isUploadingVoice;

  useEffect(() => {
    const lastCommentId = comments.at(-1)?.id ?? null;
    const hasNewLastComment = lastCommentId !== previousLastCommentIdRef.current;
    if (!hasNewLastComment) return;

    previousLastCommentIdRef.current = lastCommentId;

    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [comments]);

  useEffect(() => {
    if (commentFiles.length > 0) setShowAttach(true);
  }, [commentFiles.length]);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const isPanel = variant === "panel";
  const attachmentFallback = t("attachmentFallback");

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden border-border/70 shadow-md",
        isPanel
          ? "h-[min(70dvh,36rem)] min-h-[22rem] lg:h-[min(75dvh,48rem)]"
          : "min-h-[28rem] h-[min(65dvh,36rem)]"
      )}
    >
      {/* Compact chat header */}
      <div className="shrink-0 border-b border-border/60 bg-[hsl(var(--card))] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold sm:text-base">{title || t("title")}</h3>
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
              {description || t("description")}
            </p>
          </div>
          {comments.length > 0 ? (
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
              {comments.length}
            </span>
          ) : null}
        </div>
      </div>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
        {/* Thread — WhatsApp-like wallpaper */}
        <div
          ref={messagesContainerRef}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-3",
            "bg-[hsl(268_28%_7%)]",
            "[background-image:radial-gradient(hsl(268_20%_18%_/_0.55)_1px,transparent_1px)]",
            "[background-size:18px_18px]"
          )}
        >
          {comments.length === 0 ? (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="rounded-full bg-primary/15 p-4 text-primary">
                <MessageSquare className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground sm:text-base">
                  {t("noMessages")}
                </p>
                <p className="max-w-xs text-xs text-muted-foreground sm:text-sm">
                  {t("noMessagesHint")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {thread.map((item) => {
                if (item.kind === "day") {
                  return (
                    <div key={item.key} className="sticky top-1 z-[1] flex justify-center py-2">
                      <span className="rounded-full bg-[hsl(268_22%_14%_/_0.92)] px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-white/5 backdrop-blur">
                        {item.label}
                      </span>
                    </div>
                  );
                }

                const {
                  comment: threadComment,
                  isMine,
                  isSystem,
                  displayName,
                  displayImage,
                  showAvatar,
                  showName,
                  isFirstInGroup,
                  isLastInGroup,
                } = item;

                if (isSystem) {
                  return (
                    <div key={threadComment.id} className="flex justify-center px-2 py-1.5">
                      <div className="max-w-[92%] rounded-lg bg-[hsl(268_22%_14%_/_0.9)] px-3 py-1.5 text-center text-[11px] leading-relaxed text-muted-foreground shadow-sm ring-1 ring-white/5 sm:text-xs">
                        {threadComment.content}
                      </div>
                    </div>
                  );
                }

                const showText =
                  threadComment.content.trim().length > 0 &&
                  threadComment.content.trim() !== attachmentFallback;
                const timeLabel = formatMessageTime(threadComment.createdAt, locale);
                const isDeliverable = threadComment.type === "DELIVERABLE";

                return (
                  <div
                    key={threadComment.id}
                    className={cn(
                      "flex gap-1.5 px-1",
                      isMine ? "flex-row-reverse" : "flex-row",
                      isFirstInGroup ? "mt-2" : "mt-0.5"
                    )}
                  >
                    {!isMine ? (
                      <div className="flex w-8 shrink-0 items-end sm:w-9">
                        {showAvatar ? (
                          <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                            <AvatarImage src={displayImage || ""} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(displayName)}
                            </AvatarFallback>
                          </Avatar>
                        ) : null}
                      </div>
                    ) : null}

                    <div
                      className={cn(
                        "flex min-w-0 max-w-[min(100%,18.5rem)] flex-col sm:max-w-[min(100%,22rem)] md:max-w-sm",
                        isMine ? "items-end" : "items-start"
                      )}
                    >
                      {showName ? (
                        <span className="mb-0.5 px-1 text-[11px] font-medium text-[#E0F840]/80">
                          {displayName}
                        </span>
                      ) : null}

                      <div
                        className={cn(
                          "relative w-fit max-w-full px-3 pb-1.5 pt-2 text-[13.5px] leading-relaxed shadow-sm sm:text-sm",
                          isMine
                            ? cn(
                                "bg-primary text-primary-foreground",
                                isFirstInGroup && isLastInGroup && "rounded-2xl rounded-tr-md",
                                isFirstInGroup &&
                                  !isLastInGroup &&
                                  "rounded-2xl rounded-tr-md rounded-br-md",
                                !isFirstInGroup && isLastInGroup && "rounded-2xl rounded-tr-md",
                                !isFirstInGroup && !isLastInGroup && "rounded-2xl rounded-r-md"
                              )
                            : cn(
                                "bg-[hsl(268_24%_16%)] text-foreground ring-1 ring-white/5",
                                isFirstInGroup && isLastInGroup && "rounded-2xl rounded-tl-md",
                                isFirstInGroup &&
                                  !isLastInGroup &&
                                  "rounded-2xl rounded-tl-md rounded-bl-md",
                                !isFirstInGroup && isLastInGroup && "rounded-2xl rounded-tl-md",
                                !isFirstInGroup && !isLastInGroup && "rounded-2xl rounded-l-md"
                              )
                        )}
                      >
                        {isDeliverable ? (
                          <span
                            className={cn(
                              "mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              isMine
                                ? "bg-primary-foreground/15 text-primary-foreground"
                                : "bg-[#E0F840]/15 text-[#E0F840]"
                            )}
                          >
                            {t("deliverable")}
                          </span>
                        ) : null}

                        {showText ? (
                          <LinkifiedText
                            text={threadComment.content}
                            className={cn(
                              "whitespace-pre-wrap break-words",
                              isMine && "[&_a]:text-primary-foreground [&_a]:underline"
                            )}
                          />
                        ) : null}

                        {threadComment.files.length > 0 ? (
                          <div
                            className={cn(
                              "flex flex-col gap-2",
                              showText && "mt-2",
                              isMine ? "items-end" : "items-start"
                            )}
                          >
                            {threadComment.files.map((file: string, i: number) => (
                              <MessageFileAttachment
                                key={`${threadComment.id}-file-${i}`}
                                url={file}
                                mine={isMine}
                              />
                            ))}
                          </div>
                        ) : null}

                        <div
                          className={cn(
                            "mt-1 flex items-center justify-end gap-1 text-[10px] leading-none",
                            isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}
                        >
                          <span>{timeLabel}</span>
                          {isMine ? (
                            <CheckCheck className="h-3 w-3 opacity-80" aria-hidden />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Composer — WhatsApp-style bar */}
        {canSendMessages ? (
          <div className="shrink-0 border-t border-border/60 bg-[hsl(var(--card))] px-2 py-2 sm:px-3 sm:py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {(showAttach || commentFiles.length > 0) && (
              <div className="mb-2 max-h-36 overflow-y-auto rounded-2xl border border-border/60 bg-muted/40 p-2">
                <InlineFileUpload
                  onFilesChange={setCommentFiles}
                  maxFiles={3}
                  maxSizeMB={500}
                  disabled={addComment.isPending || isRecording || isUploadingVoice}
                  files={commentFiles}
                />
              </div>
            )}

            {isRecording ? (
              <div className="mb-2 flex items-center justify-center gap-2 rounded-full bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                </span>
                {t("recordingInProgress")}
              </div>
            ) : null}

            <ContactPolicyNotice text={comment} mode="strict" className="mb-2" />

            <div className="flex items-end gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-11 w-11 shrink-0 rounded-full",
                  (showAttach || commentFiles.length > 0) && "bg-primary/15 text-primary"
                )}
                onClick={() => setShowAttach((v) => !v)}
                disabled={addComment.isPending || isRecording || isUploadingVoice}
                title={t("attach")}
                aria-label={t("attach")}
                aria-pressed={showAttach || commentFiles.length > 0}
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              <div className="flex min-h-11 min-w-0 flex-1 items-end rounded-[1.5rem] border border-border/70 bg-muted/40 px-3 py-1.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
                <Textarea
                  ref={textareaRef}
                  placeholder={placeholder || t("placeholder")}
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    resizeTextarea();
                  }}
                  rows={1}
                  className="max-h-32 min-h-[2.25rem] flex-1 resize-none border-0 bg-transparent px-0 py-1.5 text-sm leading-snug shadow-none focus-visible:ring-0 sm:text-[15px]"
                  disabled={addComment.isPending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendComment();
                    }
                  }}
                />
              </div>

              {hasContentForSend ? (
                <Button
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(105,13,212,0.35)] hover:bg-primary/90"
                  onClick={handleSendComment}
                  disabled={sendDisabled}
                  title={t("send")}
                  aria-label={t("send")}
                >
                  {addComment.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "ghost"}
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={addComment.isPending || isUploadingVoice}
                  title={isRecording ? t("stopRecording") : t("recordVoice")}
                  aria-label={isRecording ? t("stopRecording") : t("recordVoice")}
                >
                  {isUploadingVoice ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isRecording ? (
                    <Square className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-t border-border/60 px-4 py-4 text-center text-sm text-muted-foreground">
            {t("requestCompleted")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
