"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  readonly src: string;
  readonly className?: string;
  readonly filename?: string;
}

/**
 * HTML5 audio with a download fallback when the browser cannot decode the
 * container (common: WebM recorded on Android, played in Safari/iOS).
 */
export function AudioPlayer({ src, className, filename }: AudioPlayerProps) {
  const t = useTranslations("ui.audioPlayer");
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={cn("space-y-1 text-xs text-muted-foreground", className)}>
        <p>{t("unsupported")}</p>
        <a
          href={src}
          download={filename}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {t("download")}
        </a>
      </div>
    );
  }

  return (
    <audio
      controls
      src={src}
      className={cn("h-8 w-full max-w-md", className)}
      preload="metadata"
      onError={() => setFailed(true)}
    />
  );
}
