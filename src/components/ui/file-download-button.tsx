"use client";

import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { filenameFromUrl, prettyFilename } from "@/lib/file-display";

export function suggestedDownloadName(url: string, fallback = "download"): string {
  const raw = filenameFromUrl(url);
  const pretty = prettyFilename(raw);
  if (pretty && !pretty.startsWith(".")) return pretty;
  if (raw && raw !== url) return raw;
  return fallback;
}

type FileDownloadButtonProps = {
  readonly url: string;
  readonly filename?: string;
  readonly className?: string;
  /** `overlay` for media previews; `icon` for inline file rows */
  readonly variant?: "overlay" | "icon";
};

export function FileDownloadButton({
  url,
  filename,
  className,
  variant = "overlay",
}: FileDownloadButtonProps) {
  const t = useTranslations("common.files");
  const name = filename || suggestedDownloadName(url);

  return (
    <a
      href={url}
      download={name}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      aria-label={t("download")}
      title={t("download")}
      className={cn(
        variant === "overlay"
          ? "absolute top-1.5 end-1.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          : "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}

type FilePreviewWithDownloadProps = {
  readonly url: string;
  readonly filename?: string;
  readonly className?: string;
  readonly children: ReactNode;
};

/** Relative wrapper that pins a download control on media previews. */
export function FilePreviewWithDownload({
  url,
  filename,
  className,
  children,
}: FilePreviewWithDownloadProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      <FileDownloadButton url={url} filename={filename} />
    </div>
  );
}
