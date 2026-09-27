"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Upload, X, Loader2, FileAudio } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { uploadFileToServer } from "@/lib/upload-client";
import { DEFAULT_VOICE_MAX_SIZE_MB } from "@/types/service-attributes";

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
      const file = new File([blob], filename, { type: blob.type || "audio/webm" });
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
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        setIsUploading(true);
        try {
          const blob = new Blob(chunks, { type: mimeType });
          const url = await uploadBlob(
            blob,
            `voice-${Date.now()}.${mimeType.includes("mp4") ? "m4a" : "webm"}`
          );
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
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error(t("micDenied"));
      setIsRecording(false);
      releaseMic();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
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
        if (!file.type.startsWith("audio/")) {
          toast.error(t("invalidFileType"), {
            description: t("invalidFileTypeDesc", { filename: file.name }),
          });
          continue;
        }
        const url = await uploadBlob(file, file.name);
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

        {allowUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              multiple={maxFiles > 1}
              className="hidden"
              disabled={busy || atLimit}
              onChange={(e) => handleFilePick(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || atLimit}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4 me-1.5" />
              {t("uploadAudio")}
            </Button>
          </>
        )}

        {isUploading && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("uploading")}
          </span>
        )}
      </div>

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
                <audio controls src={url} className="h-8 w-full max-w-md" preload="metadata" />
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
