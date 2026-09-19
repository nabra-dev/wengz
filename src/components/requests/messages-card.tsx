/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { InlineFileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { Send, Mic, Square } from "lucide-react";
import { formatDateTime, getInitials } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";
import { useTranslations, useLocale } from "next-intl";

interface Comment {
  id: string;
  type: string;
  content: string;
  createdAt: Date;
  user: {
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
}: MessagesCardProps) {
  const t = useTranslations("requests.messages");
  const tSidebar = useTranslations("requests.sidebar");
  const locale = useLocale();
  const [comment, setComment] = useState("");
  const [commentFiles, setCommentFiles] = useState<UploadedFile[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
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
    if (!hasContent) return;
    addComment.mutate({
      requestId,
      content: comment || t("attachmentFallback"),
      files: commentFiles.map((f) => f.url),
    });
  };

  const uploadBlobAsFile = async (blob: Blob, filename: string, type: string) => {
    const formData = new FormData();
    const file = new File([blob], filename, { type });
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return {
      url: data.url as string,
      filename: data.filename as string,
      size: data.size as number,
      type: data.type as string,
    } satisfies UploadedFile;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        try {
          const uploaded = await uploadBlobAsFile(
            blob,
            `voice-note-${Date.now()}.webm`,
            "audio/webm"
          );
          setCommentFiles((prev) => [...prev, uploaded]);
          const attachmentNumber = commentFiles.length + 1;
          toast.success(t("messageSent"), {
            description: t("attachment", { number: attachmentNumber }),
          });
        } catch (e) {
          showError(e, t("messageFailed"));
        } finally {
          setIsRecording(false);
          // Stop all audio tracks to release mic access
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
              track.stop();
            });
            streamRef.current = null;
          }
        }
      };
      mediaRecorderRef.current = mediaRecorder;
      streamRef.current = stream;
      chunksRef.current = chunks;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      showError(e, t("messageFailed"));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  // Precompute send button disabled state
  const hasContentForSend = comment.trim().length > 0 || commentFiles.length > 0;
  const sendDisabled = !hasContentForSend || addComment.isPending;

  const removeAttachment = (index: number) => {
    setCommentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const isAudioFile = (file: UploadedFile) => (file.type || "").startsWith("audio/");

  const getExtension = (url: string) => {
    try {
      const clean = url.split("?")[0];
      const parts = clean.split(".");
      return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
    } catch {
      return "";
    }
  };

  const isAudioUrl = (url: string) => {
    const ext = getExtension(url);
    return ["webm", "mp3", "ogg", "wav", "m4a", "aac"].includes(ext);
  };

  const isImageUrl = (url: string) => {
    const ext = getExtension(url);
    return ["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(ext);
  };

  const isVideoUrl = (url: string) => {
    const ext = getExtension(url);
    return ["mp4", "webm", "mov", "avi", "mkv", "mpeg", "flv", "3gp"].includes(ext);
  };

  const getFileNameFromUrl = (url: string) => {
    const clean = url.split("?")[0];
    const parts = clean.split("/");
    return parts.length > 0 ? parts.pop() || url : url;
  };

  const prettyFilename = (name: string = "") => {
    let result = name;
    // Strip leading long numeric timestamp/hash followed by hyphen
    result = result.replaceAll(/^\d{8,}-/g, "");
    // If still too long, keep last segment after another hyphen
    if (result.length > 60 && result.includes("-")) {
      const parts = result.split("-");
      result = parts.slice(1).join("-");
    }
    return result;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    const lastCommentId = comments.at(-1)?.id ?? null;
    const hasNewLastComment = lastCommentId !== previousLastCommentIdRef.current;
    if (!hasNewLastComment) return;

    previousLastCommentIdRef.current = lastCommentId;

    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [comments]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || t("title")}</CardTitle>
        <CardDescription>{description || t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t("noMessages")}</p>
        ) : (
          <div ref={messagesContainerRef} className="space-y-4 max-h-96 overflow-y-auto">
            {comments.map((comment) => {
              const isSystem = comment.type === "SYSTEM";
              let displayName: string;
              let displayImage: string | null = null;
              if (isSystem) {
                displayName = t("system");
              } else if (maskProviderNames && comment.user?.role === "PROVIDER") {
                displayName = tSidebar("brandProviderName");
                displayImage = "/images/logo.svg";
              } else if (maskClientNames && comment.user?.role === "CLIENT") {
                displayName = tSidebar("brandClientName");
              } else {
                displayName = comment.user.name || comment.user.email || "";
                displayImage = comment.user.image || null;
              }
              return (
                <div
                  key={comment.id}
                  className={`flex gap-3 ${
                    comment.type === "SYSTEM" ? "bg-muted/50 p-3 rounded-lg" : ""
                  }`}
                >
                  {!isSystem && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={displayImage || ""} />
                      <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(comment.createdAt, locale)}
                      </span>
                      {comment.type === "DELIVERABLE" && (
                        <Badge variant="secondary">{t("deliverable")}</Badge>
                      )}
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                    {comment.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {comment.files.map((file: string, i: number) => {
                          const audio = isAudioUrl(file);
                          const image = isImageUrl(file);
                          const video = isVideoUrl(file);
                          const rawFilename = getFileNameFromUrl(file);
                          const displayName = prettyFilename(rawFilename);
                          if (audio) {
                            // For voice notes, keep label only (hide autogenerated names)
                            return (
                              <div key={`${comment.id}-file-${i}`} className="space-y-1">
                                <audio controls src={file} className="w-full">
                                  <track kind="captions" />
                                </audio>
                                <div className="text-xs text-muted-foreground">
                                  {t("voiceNote")}
                                </div>
                              </div>
                            );
                          }
                          if (video) {
                            return (
                              <div key={`${comment.id}-file-${i}`} className="space-y-1">
                                <video
                                  src={file}
                                  controls
                                  className="max-h-48 rounded border"
                                  title={displayName}
                                >
                                  <track kind="captions" />
                                </video>
                                <span className="text-xs text-muted-foreground block">
                                  {t("video", { defaultValue: "Video" })} • {displayName}
                                </span>
                              </div>
                            );
                          }
                          if (image) {
                            return (
                              <a
                                key={`${comment.id}-file-${i}`}
                                href={file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img
                                  src={file}
                                  alt={displayName}
                                  className="max-h-48 rounded border object-contain"
                                />
                                <span className="text-xs text-muted-foreground block mt-1">
                                  {t("image")} • {displayName}
                                </span>
                              </a>
                            );
                          }
                          return (
                            <div key={`${comment.id}-file-${i}`} className="space-y-1">
                              <a
                                href={file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline block"
                              >
                                {t("file")}
                              </a>
                              <span className="text-xs text-muted-foreground block">
                                {displayName}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {canSendMessages && (
          <>
            <Separator />
            <div className="space-y-3">
              <InlineFileUpload
                onFilesChange={setCommentFiles}
                maxFiles={3}
                disabled={addComment.isPending}
                files={commentFiles}
              />
              {commentFiles.length > 0 && (
                <div className="space-y-2 rounded-md border p-3 bg-muted/40">
                  <div className="text-sm font-medium flex items-center justify-between">
                    <span>{t("attachmentsPending", { count: commentFiles.length })}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("attachmentsSendHint")}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {commentFiles.map((file, index) => {
                      const isAudio = isAudioFile(file);
                      const isImage = (file.type || "").startsWith("image/");
                      const name = file.filename || "";
                      const displayName = prettyFilename(name);
                      const fileTitle = isAudio ? undefined : displayName;
                      const imageLabel = isImage ? t("image") : t("file");
                      const fileLabel = isAudio ? t("voiceNote") : imageLabel;
                      const showFilename = !isAudio;

                      return (
                        <div
                          key={`${file.url}-${index}`}
                          className="flex items-center gap-2 text-sm bg-background rounded px-2 py-2 border"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate" title={fileTitle}>
                                {fileLabel}
                                {showFilename ? ` • ${displayName}` : ""}
                              </span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                            {isAudio && (
                              <audio controls src={file.url} className="mt-1 w-full">
                                <track kind="captions" />
                              </audio>
                            )}
                            {isImage && (
                              <img
                                src={file.url}
                                alt={displayName || t("image")}
                                className="mt-1 max-h-32 rounded border object-contain"
                              />
                            )}
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => removeAttachment(index)}
                            disabled={addComment.isPending}
                            aria-label="Remove attachment"
                            title="Remove"
                          >
                            ×
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={addComment.isPending}
                  title={t("recordVoice")}
                >
                  {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Textarea
                  placeholder={placeholder || t("placeholder")}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
                <Button size="icon" onClick={handleSendComment} disabled={sendDisabled}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {!canSendMessages && (
          <>
            <Separator />
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">{t("requestCompleted")}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
