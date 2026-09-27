/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */
"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { cn, formatDateTime, getInitials } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";
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
          "w-full max-w-[min(100%,20rem)] space-y-1.5 rounded-xl border p-2.5 sm:max-w-sm",
          mine ? "border-primary-foreground/20 bg-primary/20" : "border-border bg-background/80"
        )}
      >
        <div className="flex items-center gap-2 text-xs opacity-80">
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
        className="block w-full max-w-[min(100%,16rem)] overflow-hidden rounded-xl border sm:max-w-xs"
      >
        <img src={url} alt={name} className="max-h-52 w-full object-cover bg-muted" />
      </a>
    );
  }

  if (kind === "video") {
    return (
      <div className="w-full max-w-[min(100%,20rem)] overflow-hidden rounded-xl border sm:max-w-sm">
        <video src={url} controls className="max-h-52 w-full bg-muted" title={name}>
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
        "inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
        mine
          ? "border-primary-foreground/20 bg-primary/20"
          : "border-border bg-background/80 hover:bg-muted/60"
      )}
    >
      <KindGlyph kind={kind} />
      <span className="truncate font-medium">{name}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  );
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
  const previousLastCommentIdRef = useRef<string | null>(null);

  const utils = trpc.useUtils();

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
      utils.request.getById.invalidate({ id: requestId });
      toast.success(t("messageSent"), {
        description: t("messageSuccess"),
      });
    },
    onError: (error: unknown) => {
      showError(error, t("messageFailed"));
    },
  });

  const handleSendComment = () => {
    const hasContent = comment.trim().length > 0 || commentFiles.length > 0;
    if (!hasContent || addComment.isPending || isRecording || isUploadingVoice) return;
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
          toast.success(t("voiceAttached"), {
            description: t("voiceAttachedHint"),
          });
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

  const isPanel = variant === "panel";

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden border-border/80 shadow-sm",
        isPanel
          ? // Height often overridden by RequestWorkspace on mobile for full-viewport chat
            "h-[min(70dvh,36rem)] min-h-[22rem] lg:h-[min(75dvh,48rem)]"
          : "min-h-[28rem] h-[min(65dvh,36rem)]"
      )}
    >
      <CardHeader className="shrink-0 space-y-0.5 border-b bg-muted/30 px-3 py-3 sm:px-4 sm:py-3.5">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          {title || t("title")}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm line-clamp-1">
          {description || t("description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
        {/* Thread */}
        <div
          ref={messagesContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 space-y-3"
        >
          {comments.length === 0 ? (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-40" />
              <p className="text-sm sm:text-base font-medium">{t("noMessages")}</p>
              <p className="text-xs sm:text-sm max-w-xs">{t("noMessagesHint")}</p>
            </div>
          ) : (
            comments.map((threadComment) => {
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
              const showText =
                threadComment.content.trim().length > 0 &&
                threadComment.content.trim() !== t("attachmentFallback");

              if (isSystem) {
                return (
                  <div key={threadComment.id} className="flex justify-center px-2">
                    <div className="max-w-[90%] rounded-full bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground sm:text-sm">
                      {threadComment.content}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={threadComment.id}
                  className={cn("flex gap-2 sm:gap-3", isMine ? "flex-row-reverse" : "flex-row")}
                >
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 mt-0.5">
                    <AvatarImage src={displayImage || ""} />
                    <AvatarFallback className="text-xs">{getInitials(displayName)}</AvatarFallback>
                  </Avatar>

                  <div
                    className={cn(
                      "min-w-0 max-w-[min(100%,20rem)] sm:max-w-[min(100%,24rem)] md:max-w-md flex flex-col gap-1",
                      isMine ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-muted-foreground",
                        isMine && "flex-row-reverse"
                      )}
                    >
                      <span className="font-medium text-foreground/80">{displayName}</span>
                      <span>{formatDateTime(threadComment.createdAt, locale)}</span>
                      {threadComment.type === "DELIVERABLE" && (
                        <Badge variant="secondary" className="h-5 text-[10px]">
                          {t("deliverable")}
                        </Badge>
                      )}
                    </div>

                    {showText && (
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words shadow-sm",
                          isMine
                            ? "rounded-tr-md bg-primary text-primary-foreground"
                            : "rounded-tl-md bg-muted text-foreground"
                        )}
                      >
                        {threadComment.content}
                      </div>
                    )}

                    {threadComment.files.length > 0 && (
                      <div
                        className={cn(
                          "flex flex-col gap-2 w-full",
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
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        {canSendMessages ? (
          <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-2.5 py-2.5 sm:px-3 sm:py-3 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            {(showAttach || commentFiles.length > 0) && (
              <div className="mb-2.5 max-h-40 overflow-y-auto rounded-xl border bg-muted/30 p-2">
                <InlineFileUpload
                  onFilesChange={setCommentFiles}
                  maxFiles={3}
                  maxSizeMB={500}
                  disabled={addComment.isPending || isRecording || isUploadingVoice}
                  files={commentFiles}
                />
              </div>
            )}

            {isRecording && (
              <p className="mb-2 text-center text-xs font-medium text-destructive sm:text-sm">
                {t("recordingInProgress")}
              </p>
            )}

            <div className="flex items-end gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant={showAttach || commentFiles.length > 0 ? "secondary" : "ghost"}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                onClick={() => setShowAttach((v) => !v)}
                disabled={addComment.isPending || isRecording || isUploadingVoice}
                title={t("attach")}
                aria-label={t("attach")}
                aria-pressed={showAttach || commentFiles.length > 0}
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              <Button
                type="button"
                variant={isRecording ? "destructive" : "ghost"}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
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

              <Textarea
                placeholder={placeholder || t("placeholder")}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={1}
                className="min-h-11 max-h-32 flex-1 resize-none rounded-xl px-3 py-2.5 text-sm sm:text-base leading-snug"
                disabled={addComment.isPending}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendComment();
                  }
                }}
              />

              <Button
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
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
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-t px-4 py-4 text-center text-sm text-muted-foreground">
            {t("requestCompleted")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
