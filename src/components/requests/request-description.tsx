/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface RequestDescriptionProps {
  readonly description: string;
  readonly attachments?: string[];
}

export function RequestDescription({ description, attachments }: RequestDescriptionProps) {
  const t = useTranslations("requests.description");

  const isImage = (file: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
  const isVideo = (file: string) => /\.(mp4|webm|mov|avi|mkv|mpeg|flv|3gp)$/i.test(file);
  const isAudio = (file: string) => /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(file);

  const renderMediaFile = (file: string, fileName: string) => {
    if (isImage(file)) {
      return (
        <a href={file} target="_blank" rel="noopener noreferrer" className="block">
          <div className="aspect-video rounded overflow-hidden bg-muted mb-2 flex items-center justify-center">
            <img src={file} alt={fileName} className="w-full h-full object-cover" />
          </div>
        </a>
      );
    }

    if (isVideo(file)) {
      return (
        <div className="aspect-video rounded overflow-hidden bg-muted mb-2 flex items-center justify-center">
          <video src={file} controls className="w-full h-full object-cover" title={fileName}>
            <track kind="captions" />
          </video>
        </div>
      );
    }

    if (isAudio(file)) {
      return (
        <div className="aspect-video rounded bg-muted mb-2 flex items-center justify-center">
          <audio controls className="w-full" title={fileName}>
            <source src={file} />
            <track kind="captions" />
          </audio>
        </div>
      );
    }

    return (
      <a href={file} target="_blank" rel="noopener noreferrer" className="block">
        <div className="aspect-video rounded bg-muted mb-2 flex items-center justify-center text-2xl">
          📎
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
        <p className="whitespace-pre-wrap">{description}</p>

        {/* Request Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">
              {t("attachments", { count: attachments.length })}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {attachments.map((file: string, index: number) => {
                const fileName =
                  file.split("/").pop() || t("attachmentFallback", { number: index + 1 });
                return (
                  <div
                    key={file}
                    className="group p-2 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                  >
                    {renderMediaFile(file, fileName)}
                    <a href={file} target="_blank" rel="noopener noreferrer" className="block">
                      <p className="text-xs text-muted-foreground truncate group-hover:text-foreground">
                        {fileName}
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
