"use client";

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Upload, FileIcon, Image, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

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

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  // Audio types for voice notes
  "audio/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/mp4",
  "audio/wav",
  "audio/m4a",
  "audio/aac",
  // Video types
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mpeg",
]);

export function FileUpload({
  onFilesChange,
  maxFiles = 5,
  maxSizeMB = 10,
  accept = "image/*,.pdf,.zip,audio/*,video/*",
  className,
  disabled = false,
}: FileUploadProps) {
  const t = useTranslations("ui.fileUpload");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    // Validate file type
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error(t("invalidFileType"), {
        description: t("invalidFileTypeDesc", { filename: file.name }),
      });
      return null;
    }

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(t("fileTooLarge"), {
        description: t("fileTooLargeDesc", { filename: file.name, maxSize: maxSizeMB }),
      });
      return null;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
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
  };

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

      const results = await Promise.all(filesToUpload.map(uploadFile));
      const successfulUploads = results.filter((r): r is UploadedFile => r !== null);

      if (successfulUploads.length > 0) {
        const newFiles = [...uploadedFiles, ...successfulUploads];
        setUploadedFiles(newFiles);
        onFilesChange(newFiles);
        toast.success(t("uploadComplete"), {
          description: t("uploadCompleteDesc", { count: successfulUploads.length }),
        });
      }

      setIsUploading(false);
    },
    [uploadedFiles, maxFiles, onFilesChange]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (!disabled) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles]
  );

  const removeFile = createRemoveFileHandler(uploadedFiles, setUploadedFiles, onFilesChange);

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    if (type === "application/pdf") {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    return <FileIcon className="h-4 w-4 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop zone */}
      <section
        aria-label="File upload drop zone"
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
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
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || isUploading}
        />

        <div className="flex flex-col items-center gap-2">
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">{t("uploading")}</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <Button
                  className="bg-primary/10 text-primary hover:bg-primary/20 hover:text-black focus:ring-2 focus:ring-primary/30"
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled || uploadedFiles.length >= maxFiles}
                >
                  {t("clickToUpload")}
                </Button>
                <span className="text-sm text-muted-foreground"> {t("dragAndDrop")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("fileTypesInfo", { maxSize: maxSizeMB, maxFiles })}
              </p>
            </>
          )}
        </div>
      </section>

      {/* Uploaded files list */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t("attachedCount", { count: uploadedFiles.length, maxFiles })}
          </p>
          <div className="space-y-1">
            {uploadedFiles.map((file, index) => (
              <div
                key={`${file.url}-${index}`}
                className="flex items-center gap-2 p-2 bg-muted rounded-md"
              >
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
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

// Helper to create removeFile handler
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
// Compact version for inline use (e.g., in chat)
export function InlineFileUpload({
  onFilesChange,
  maxFiles = 3,
  disabled = false,
  files = [],
}: {
  readonly onFilesChange: (files: UploadedFile[]) => void;
  readonly maxFiles?: number;
  readonly disabled?: boolean;
  readonly files?: UploadedFile[];
}) {
  const t = useTranslations("ui.fileUpload");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(files);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal state with external files prop only when files prop actually changes
  React.useEffect(() => {
    setUploadedFiles(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(files)]);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error(t("invalidFileType"));
      return null;
    }

    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(t("fileTooLargeShort"));
      return null;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
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

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = maxFiles - uploadedFiles.length;
    if (remainingSlots <= 0) {
      toast.error(t("maxFilesShort", { maxFiles }));
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setIsUploading(true);

    const results = await Promise.all(filesToUpload.map(uploadFile));
    const successfulUploads = results.filter((r): r is UploadedFile => r !== null);

    if (successfulUploads.length > 0) {
      const newFiles = [...uploadedFiles, ...successfulUploads];
      setUploadedFiles(newFiles);
      onFilesChange(newFiles);
    }

    setIsUploading(false);
  };

  const removeFile = createRemoveFileHandler(uploadedFiles, setUploadedFiles, onFilesChange);

  const clearFiles = () => {
    setUploadedFiles([]);
    onFilesChange([]);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.zip,audio/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || isUploading}
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading || uploadedFiles.length >= maxFiles}
          className="flex items-center gap-2"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span>{isUploading ? t("uploading") : t("attachFiles")}</span>
        </Button>

        {uploadedFiles.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {t("filesAttached", { count: uploadedFiles.length })}
          </span>
        )}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedFiles.map((file, index) => (
            <div
              key={`${file.url}-${index}`}
              className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
            >
              <span className="truncate max-w-[150px]">{file.filename}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0"
                onClick={() => removeFile(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={clearFiles} className="text-xs">
            {t("clearAll")}
          </Button>
        </div>
      )}
    </div>
  );
}
