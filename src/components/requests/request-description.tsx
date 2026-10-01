/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { AudioPlayer } from "@/components/ui/audio-player";
import { LinkifiedText } from "@/components/ui/linkified-text";
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
        <a href={file} target="_blank" rel="noopener noreferrer" className="block">
          <div className="aspect-square rounded-md overflow-hidden bg-muted mb-2 flex items-center justify-center">
            <img src={file} alt={displayName} className="w-full h-full object-cover" />
          </div>
        </a>
      );
    }

    if (kind === "audio") {
      return (
        <div className="rounded-md bg-muted mb-2 p-2">
          <AudioPlayer src={file} className="w-full" filename={displayName} />
        </div>
      );
    }

    if (kind === "video") {
      return (
        <div className="aspect-video rounded-md overflow-hidden bg-muted mb-2 flex items-center justify-center">
          <video src={file} controls className="w-full h-full object-cover" title={displayName}>
            <track kind="captions" />
          </video>
        </div>
      );
    }

    const Icon = kind === "pdf" ? FileText : kind === "archive" ? FileArchive : FileIcon;

    return (
      <a href={file} target="_blank" rel="noopener noreferrer" className="block">
        <div className="aspect-square rounded-md bg-muted mb-2 flex items-center justify-center text-muted-foreground">
          <Icon className="h-8 w-8" />
        </div>
      </a>
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
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">
              {t("attachments", { count: attachments.length })}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {attachments.map((file: string, index: number) => {
                const displayName = labelFor(file, index);
                return (
                  <div
                    key={file}
                    className="group p-2 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                  >
                    {renderMediaFile(file, displayName)}
                    <a href={file} target="_blank" rel="noopener noreferrer" className="block">
                      <p className="text-xs text-muted-foreground truncate group-hover:text-foreground">
                        {displayName}
                      </p>
                    </a>
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
