"use client";

/* eslint-disable @next/next/no-img-element -- user-uploaded /api/files URLs */

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  Upload,
  FileIcon,
  FileText,
  FileArchive,
  FileAudio,
  FileVideo,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  isAllowedUploadMime,
  resolveUploadMime,
  REQUEST_ATTACHMENT_MAX_MB,
  UPLOAD_ACCEPT_ATTR,
} from "@/lib/upload-limits";
import { uploadFileToServer } from "@/lib/upload-client";
import { prettyFilename, resolveFileKind, type FileKind } from "@/lib/file-display";
import { AudioPlayer } from "@/components/ui/audio-player";

export interface UploadedFile {
  url: string;
  filename: string;
  size: number;
  type: string;
}

interface FileUploadProps {
  readonly onFilesChange: (files: UploadedFile[]) => void;
  readonly maxFiles?: number;
  readonly maxSizeMB?: number;
  readonly accept?: string;
  readonly className?: string;
  readonly disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function friendlyUploadName(file: UploadedFile, kind: FileKind, voiceLabel: string): string {
  const pretty = prettyFilename(file.filename);
  if (kind === "audio") return voiceLabel;
  if (pretty && !pretty.startsWith(".")) return pretty;
  const ext = file.filename.includes(".") ? file.filename.split(".").pop() : "";
  if (kind === "image") return ext ? `Image.${ext}` : "Image";
  if (kind === "pdf") return ext ? `PDF.${ext}` : "PDF";
  if (kind === "video") return ext ? `Video.${ext}` : "Video";
  return ext ? `File.${ext}` : "File";
}

function KindIcon({ kind }: { readonly kind: FileKind }) {
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

function createRemoveFileHandler(
  uploadedFiles: UploadedFile[],
  setUploadedFiles: (files: UploadedFile[]) => void,
  onFilesChange: (files: UploadedFile[]) => void
) {
  return (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onFilesChange(newFiles);
  };
}

export function FileUpload({
  onFilesChange,
  maxFiles = 5,
  maxSizeMB = REQUEST_ATTACHMENT_MAX_MB,
  accept = UPLOAD_ACCEPT_ATTR,
  className,
  disabled = false,
}: FileUploadProps) {
  const t = useTranslations("ui.fileUpload");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      if (!isAllowedUploadMime(file.type, file.name)) {
        toast.error(t("invalidFileType"), {
          description: t("invalidFileTypeDesc", { filename: file.name }),
        });
        return null;
      }

      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        toast.error(t("fileTooLarge"), {
          description: t("fileTooLargeDesc", { filename: file.name, maxSize: maxSizeMB }),
        });
        return null;
      }

      const mime = resolveUploadMime(file.type, file.name) || file.type;
      const normalized =
        mime && mime !== file.type ? new File([file], file.name, { type: mime }) : file;

      try {
        const data = await uploadFileToServer(normalized, {
          maxSizeBytes,
          onProgress: (p) => setUploadPercent(p.percent),
        });
        return {
          url: data.url,
          filename: data.filename,
          size: data.size,
          type: data.type,
        };
      } catch (error) {
        toast.error(t("uploadFailed"), {
          description: error instanceof Error ? error.message : t("uploadFailedDesc"),
        });
        return null;
      }
    },
    [maxSizeMB, t]
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const remainingSlots = maxFiles - uploadedFiles.length;
      if (remainingSlots <= 0) {
        toast.error(t("maximumFilesReached"), {
          description: t("maximumFilesDesc", { maxFiles }),
        });
        return;
      }

      const filesToUpload = Array.from(files).slice(0, remainingSlots);
      setIsUploading(true);
      setUploadPercent(0);

      const successfulUploads: UploadedFile[] = [];
      for (const file of filesToUpload) {
        const result = await uploadFile(file);
        if (result) successfulUploads.push(result);
      }

      if (successfulUploads.length > 0) {
        const newFiles = [...uploadedFiles, ...successfulUploads];
        setUploadedFiles(newFiles);
        onFilesChange(newFiles);
        toast.success(t("uploadComplete"), {
          description: t("uploadCompleteDesc", { count: successfulUploads.length }),
        });
      }

      setIsUploading(false);
      setUploadPercent(null);
      if (inputRef.current) inputRef.current.value = "";
    },
    [maxFiles, uploadedFiles, onFilesChange, uploadFile, t]
  );

  const removeFile = createRemoveFileHandler(uploadedFiles, setUploadedFiles, onFilesChange);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled || isUploading) return;
    void handleFiles(e.dataTransfer.files);
  };

  const atLimit = uploadedFiles.length >= maxFiles;
  const canPick = !disabled && !isUploading && !atLimit;

  return (
    <div className={cn("space-y-4", className)}>
      <button
        type="button"
        aria-label={t("clickToUpload")}
        disabled={!canPick}
        className={cn(
          "relative flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors sm:py-10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          dragActive
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/30 hover:border-primary/55 hover:bg-primary/5",
          canPick ? "cursor-pointer" : "cursor-not-allowed opacity-60"
        )}
        onClick={() => {
          if (canPick) inputRef.current?.click();
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={!canPick}
        />

        {isUploading ? (
          <>
            <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {uploadPercent === null
                ? t("uploading")
                : t("uploadingProgress", { percent: uploadPercent })}
            </p>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="h-6 w-6" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary">{t("clickToUpload")}</p>
              <p className="text-sm text-muted-foreground">{t("dragAndDrop")}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("fileTypesInfo", { maxSize: maxSizeMB, maxFiles })}
            </p>
          </>
        )}
      </button>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t("attachedCount", { count: uploadedFiles.length, maxFiles })}
          </p>
          <div className="space-y-1">
            {uploadedFiles.map((file, index) => (
              <div
                key={`${file.url}-${index}`}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="truncate">{file.filename}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact attach control for chat — rich previews, no duplicate filename chips. */
export function InlineFileUpload({
  onFilesChange,
  maxFiles = 3,
  maxSizeMB = REQUEST_ATTACHMENT_MAX_MB,
  disabled = false,
  files = [],
}: {
  readonly onFilesChange: (files: UploadedFile[]) => void;
  readonly maxFiles?: number;
  readonly maxSizeMB?: number;
  readonly disabled?: boolean;
  readonly files?: UploadedFile[];
}) {
  const t = useTranslations("ui.fileUpload");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(files);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setUploadedFiles(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(files)]);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    if (!isAllowedUploadMime(file.type, file.name)) {
      toast.error(t("invalidFileType"));
      return null;
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(t("fileTooLargeShort", { maxSize: maxSizeMB }));
      return null;
    }

    const mime = resolveUploadMime(file.type, file.name) || file.type;
    const normalized =
      mime && mime !== file.type ? new File([file], file.name, { type: mime }) : file;

    try {
      const data = await uploadFileToServer(normalized, {
        maxSizeBytes,
        onProgress: (p) => setUploadPercent(p.percent),
      });
      return {
        url: data.url,
        filename: data.filename,
        size: data.size,
        type: data.type,
      };
    } catch {
      toast.error(t("uploadFailed"));
      return null;
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = maxFiles - uploadedFiles.length;
    if (remainingSlots <= 0) {
      toast.error(t("maxFilesShort", { maxFiles }));
      return;
    }

    const filesToUpload = Array.from(fileList).slice(0, remainingSlots);
    setIsUploading(true);
    setUploadPercent(0);

    const successfulUploads: UploadedFile[] = [];
    for (const file of filesToUpload) {
      const result = await uploadFile(file);
      if (result) successfulUploads.push(result);
    }

    if (successfulUploads.length > 0) {
      const newFiles = [...uploadedFiles, ...successfulUploads];
      setUploadedFiles(newFiles);
      onFilesChange(newFiles);
    }

    setIsUploading(false);
    setUploadPercent(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = createRemoveFileHandler(uploadedFiles, setUploadedFiles, onFilesChange);

  const clearFiles = () => {
    setUploadedFiles([]);
    onFilesChange([]);
  };

  const canPick = !disabled && !isUploading && uploadedFiles.length < maxFiles;
  const hasFiles = uploadedFiles.length > 0;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={!canPick}
      />

      {/* Previews first — chat panel used to clip these below a tall dropzone. */}
      {hasFiles ? (
        <ul className="space-y-2">
          {uploadedFiles.map((file, index) => {
            const kind = resolveFileKind(
              file.url,
              file.type.startsWith("audio/") ? "voice" : "file"
            );
            const name = friendlyUploadName(file, kind, t("voiceNote"));
            return (
              <li
                key={`${file.url}-${index}`}
                className="relative rounded-lg border bg-background/60 p-2.5"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute end-1 top-1 h-7 w-7"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                  aria-label={t("removeFile")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>

                {kind === "image" ? (
                  <div className="flex gap-3 pe-8">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted"
                    >
                      <img src={file.url} alt={name} className="h-full w-full object-cover" />
                    </a>
                    <div className="min-w-0 self-center">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                ) : kind === "audio" ? (
                  <div className="space-y-2 pe-8">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FileAudio className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <AudioPlayer src={file.url} filename={name} className="w-full" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pe-8">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <KindIcon kind={kind} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {hasFiles ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {t("filesAttached", { count: uploadedFiles.length })}
          </span>
          <div className="flex items-center gap-1">
            {canPick || isUploading ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (canPick) inputRef.current?.click();
                }}
                disabled={!canPick}
                className="h-8 gap-1.5 text-xs"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {isUploading
                  ? uploadPercent === null
                    ? t("uploading")
                    : t("uploadingProgress", { percent: uploadPercent })
                  : t("attachFiles")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFiles}
              className="h-8 text-xs"
              disabled={disabled || isUploading}
            >
              {t("clearAll")}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (canPick) inputRef.current?.click();
          }}
          disabled={!canPick}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-4 text-center transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            canPick
              ? "cursor-pointer border-muted-foreground/30 hover:border-primary/55 hover:bg-primary/5"
              : "cursor-not-allowed border-muted-foreground/20 opacity-60"
          )}
          aria-label={t("attachFiles")}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {uploadPercent === null
                  ? t("uploading")
                  : t("uploadingProgress", { percent: uploadPercent })}
              </span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">{t("attachFiles")}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
