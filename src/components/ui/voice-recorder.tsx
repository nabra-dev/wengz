"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Upload, X, Loader2, FileAudio } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { uploadFileToServer } from "@/lib/upload-client";
import { DEFAULT_VOICE_MAX_SIZE_MB } from "@/types/service-attributes";
import { isAudioLikeFile, pickSupportedAudioMime } from "@/lib/audio-recording";
import { normalizeUploadMime } from "@/lib/upload-limits";
import { AudioPlayer } from "@/components/ui/audio-player";

interface VoiceRecorderProps {
  readonly value: string[];
  readonly onChange: (urls: string[]) => void;
  readonly maxFiles?: number;
  readonly maxSizeMB?: number;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly allowUpload?: boolean;
}

function filenameFromUrl(url: string): string {
  try {
    const path = url.split("?")[0] ?? url;
    const part = path.split("/").pop();
    return part ? decodeURIComponent(part) : url;
  } catch {
    return url;
  }
}

export function VoiceRecorder({
  value,
  onChange,
  maxFiles = 1,
  maxSizeMB = DEFAULT_VOICE_MAX_SIZE_MB,
  disabled = false,
  className,
  allowUpload = true,
}: VoiceRecorderProps) {
  const t = useTranslations("ui.voiceRecorder");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const releaseMic = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const uploadBlob = useCallback(
    async (blob: Blob, filename: string) => {
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (blob.size > maxSizeBytes) {
        toast.error(t("fileTooLarge"), {
          description: t("fileTooLargeDesc", { maxSize: maxSizeMB }),
        });
        return null;
      }
      if (blob.size === 0) {
        toast.error(t("uploadFailed"), {
          description: t("emptyRecording"),
        });
        return null;
      }
      const type = normalizeUploadMime(blob.type) || "audio/webm";
      const file = new File([blob], filename, { type });
      try {
        const data = await uploadFileToServer(file, { maxSizeBytes });
        return data.url;
      } catch (error) {
        toast.error(t("uploadFailed"), {
          description: error instanceof Error ? error.message : t("uploadFailedDesc"),
        });
        return null;
      }
    },
    [maxSizeMB, t]
  );

  const appendUrl = useCallback(
    (url: string) => {
      if (value.length >= maxFiles) {
        toast.error(t("maximumFilesReached"), {
          description: t("maximumFilesDesc", { maxFiles }),
        });
        return;
      }
      onChange([...value, url]);
    },
    [value, maxFiles, onChange, t]
  );

  const startRecording = async () => {
    if (disabled || isUploading || value.length >= maxFiles) return;
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
        setIsUploading(true);
        try {
          const blobType =
            normalizeUploadMime(mediaRecorder.mimeType) || picked.fileType || "audio/webm";
          const blob = new Blob(chunks, { type: blobType });
          const url = await uploadBlob(blob, `voice-${Date.now()}.${picked.extension}`);
          if (url) {
            appendUrl(url);
            toast.success(t("recordingSaved"));
          }
        } finally {
          setIsUploading(false);
          setIsRecording(false);
          releaseMic();
        }
      };
      mediaRecorderRef.current = mediaRecorder;
      streamRef.current = stream;
      // Timeslice helps mobile browsers flush chunks before stop.
      mediaRecorder.start(250);
      setIsRecording(true);
    } catch {
      toast.error(t("micDenied"));
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

  const handleFilePick = async (files: FileList | null) => {
    if (!files?.length || disabled || isUploading) return;
    const remaining = maxFiles - value.length;
    if (remaining <= 0) {
      toast.error(t("maximumFilesReached"), {
        description: t("maximumFilesDesc", { maxFiles }),
      });
      return;
    }
    setIsUploading(true);
    try {
      const toUpload = Array.from(files).slice(0, remaining);
      const urls: string[] = [];
      for (const file of toUpload) {
        if (!isAudioLikeFile(file)) {
          toast.error(t("invalidFileType"), {
            description: t("invalidFileTypeDesc", { filename: file.name }),
          });
          continue;
        }
        const type = normalizeUploadMime(file.type) || "audio/webm";
        const normalized = new File([file], file.name, { type });
        const url = await uploadBlob(normalized, file.name);
        if (url) urls.push(url);
      }
      if (urls.length > 0) {
        onChange([...value, ...urls]);
        toast.success(t("uploadComplete"), {
          description: t("uploadCompleteDesc", { count: urls.length }),
        });
      }
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const busy = disabled || isUploading;
  const atLimit = value.length >= maxFiles;

  const canUpload = allowUpload && !busy && !atLimit;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={isRecording ? "destructive" : "outline"}
          size="sm"
          disabled={busy || (!isRecording && atLimit)}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? (
            <>
              <Square className="h-4 w-4 me-1.5" />
              {t("stop")}
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 me-1.5" />
              {t("record")}
            </>
          )}
        </Button>

        {isUploading && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("uploading")}
          </span>
        )}
      </div>

      {allowUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.webm,.m4a,.mp3,.ogg,.wav,.aac"
            multiple={maxFiles > 1}
            className="hidden"
            disabled={!canUpload}
            onChange={(e) => handleFilePick(e.target.files)}
          />
          <button
            type="button"
            disabled={!canUpload}
            onClick={() => {
              if (canUpload) inputRef.current?.click();
            }}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-5 text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              canUpload
                ? "cursor-pointer border-muted-foreground/30 hover:border-primary/55 hover:bg-primary/5"
                : "cursor-not-allowed border-muted-foreground/20 opacity-60"
            )}
            aria-label={t("uploadAudio")}
          >
            <Upload className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">{t("uploadAudio")}</span>
          </button>
        </>
      )}

      <p className="text-xs text-muted-foreground">{t("hint", { maxSize: maxSizeMB, maxFiles })}</p>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className="flex items-start gap-2 rounded-md border bg-muted/40 p-2"
            >
              <FileAudio className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-xs font-medium">{filenameFromUrl(url)}</p>
                <AudioPlayer src={url} filename={filenameFromUrl(url)} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={disabled || isRecording}
                onClick={() => removeAt(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
