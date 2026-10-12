/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { AudioPlayer } from "@/components/ui/audio-player";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { FileDownloadButton, FilePreviewWithDownload } from "@/components/ui/file-download-button";
import { filenameFromUrl, prettyFilename, resolveFileKind } from "@/lib/file-display";
import { FileArchive, FileIcon, FileText } from "lucide-react";

interface RequestDescriptionProps {
  readonly description: string;
  readonly attachments?: string[];
}

export function RequestDescription({ description, attachments }: RequestDescriptionProps) {
  const t = useTranslations("requests.description");

  const labelFor = (file: string, index: number): string => {
    const raw = filenameFromUrl(file);
    const pretty = prettyFilename(raw);
    if (pretty && !pretty.startsWith(".")) return pretty;
    const kind = resolveFileKind(file);
    const fallback =
      kind === "image"
        ? t("kinds.image")
        : kind === "audio"
          ? t("kinds.audio")
          : kind === "video"
            ? t("kinds.video")
            : kind === "pdf"
              ? t("kinds.pdf")
              : t("attachmentFallback", { number: index + 1 });
    const ext = raw.includes(".") ? raw.split(".").pop() : "";
    return ext && pretty.startsWith(".") ? `${fallback}.${ext}` : fallback;
  };

  const renderMediaFile = (file: string, displayName: string) => {
    const kind = resolveFileKind(file);

    if (kind === "image") {
      return (
        <FilePreviewWithDownload url={file} filename={displayName} className="mb-2">
          <a href={file} target="_blank" rel="noopener noreferrer" className="block">
            <div className="aspect-square overflow-hidden rounded-md bg-muted flex items-center justify-center">
              <img src={file} alt={displayName} className="h-full w-full object-cover" />
            </div>
          </a>
        </FilePreviewWithDownload>
      );
    }

    if (kind === "audio") {
      return (
        <div className="relative mb-2 rounded-md bg-muted p-2 pe-10">
          <FileDownloadButton url={file} filename={displayName} className="top-2 end-2" />
          <AudioPlayer src={file} className="w-full" filename={displayName} />
        </div>
      );
    }

    if (kind === "video") {
      return (
        <FilePreviewWithDownload url={file} filename={displayName} className="mb-2">
          <div className="aspect-video overflow-hidden rounded-md bg-muted flex items-center justify-center">
            <video src={file} controls className="h-full w-full object-cover" title={displayName}>
              <track kind="captions" />
            </video>
          </div>
        </FilePreviewWithDownload>
      );
    }

    const Icon = kind === "pdf" ? FileText : kind === "archive" ? FileArchive : FileIcon;

    return (
      <div className="relative mb-2">
        <a href={file} target="_blank" rel="noopener noreferrer" className="block">
          <div className="aspect-square rounded-md bg-muted flex items-center justify-center text-muted-foreground">
            <Icon className="h-8 w-8" />
          </div>
        </a>
        <FileDownloadButton url={file} filename={displayName} />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <LinkifiedText text={description} />

        {attachments && attachments.length > 0 && (
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">
              {t("attachments", { count: attachments.length })}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {attachments.map((file: string, index: number) => {
                const displayName = labelFor(file, index);
                return (
                  <div
                    key={file}
                    className="group rounded-lg border bg-background p-2 transition-colors hover:bg-muted/50"
                  >
                    {renderMediaFile(file, displayName)}
                    <div className="flex items-center gap-1">
                      <a
                        href={file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1"
                      >
                        <p className="truncate text-xs text-muted-foreground group-hover:text-foreground">
                          {displayName}
                        </p>
                      </a>
                      <FileDownloadButton
                        url={file}
                        filename={displayName}
                        variant="icon"
                        className="h-7 w-7"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
