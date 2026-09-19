/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations, useLocale } from "next-intl";
import { formatDateTime, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

interface ProviderDeliverablesProps {
  readonly comments: Comment[];
  readonly providerName?: string;
  readonly providerImage?: string | null;
}

export function ProviderDeliverables({
  comments,
  providerName = "Provider",
  providerImage,
}: ProviderDeliverablesProps) {
  const t = useTranslations("requests.deliverables");
  const locale = useLocale();

  const deliverableComments = comments.filter((c) => c.type === "DELIVERABLE");

  if (deliverableComments.length === 0) {
    return null;
  }

  const isImage = (file: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
  const isVideo = (file: string) => /\.(mp4|webm|mov|avi|mkv|mpeg|flv|3gp)$/i.test(file);
  const isAudio = (file: string) => /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(file);

  const getFileNameFromUrl = (url: string) => {
    const clean = url.split("?")[0];
    const parts = clean.split("/");
    return parts.length > 0 ? parts.pop() || url : url;
  };

  const prettyFilename = (name: string = "") => {
    let result = name;
    result = result.replaceAll(/^\d{8,}-/g, "");
    if (result.length > 60 && result.includes("-")) {
      const parts = result.split("-");
      result = parts.slice(1).join("-");
    }
    return result;
  };

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <CardTitle className="text-green-800">
          {t("title", { defaultValue: "Provider Deliverables" })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {deliverableComments.map((comment, idx) => (
          <div
            key={comment.id}
            className={`space-y-3 ${idx > 0 ? "pt-4 border-t border-green-200" : ""}`}
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8 mt-0.5">
                <AvatarImage src={providerImage || ""} />
                <AvatarFallback>{getInitials(providerName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-green-900">{providerName}</span>
                  <Badge variant="default" className="bg-green-700">
                    {t("badge", { defaultValue: "Deliverable" })}
                  </Badge>
                  <span className="text-xs text-green-700">
                    {formatDateTime(comment.createdAt, locale)}
                  </span>
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap text-green-900">{comment.content}</p>

                {/* Deliverable Files */}
                {comment.files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-green-800">
                      {t("filesLabel", {
                        count: comment.files.length,
                        defaultValue: `${comment.files.length} file(s)`,
                      })}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {comment.files.map((file: string, fileIdx: number) => {
                        const fileName = getFileNameFromUrl(file);
                        const displayName = prettyFilename(fileName);

                        if (isImage(file)) {
                          return (
                            <a
                              key={`${comment.id}-file-${fileIdx}`}
                              href={file}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group block p-2 rounded border border-green-200 bg-white hover:bg-green-100 transition-colors"
                            >
                              <div className="aspect-video rounded overflow-hidden mb-1 flex items-center justify-center bg-green-100">
                                <img
                                  src={file}
                                  alt={displayName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <p className="text-xs text-green-700 truncate group-hover:text-green-900">
                                {displayName}
                              </p>
                            </a>
                          );
                        }

                        if (isVideo(file)) {
                          return (
                            <div
                              key={`${comment.id}-file-${fileIdx}`}
                              className="group p-2 rounded border border-green-200 bg-white"
                            >
                              <div className="aspect-video rounded overflow-hidden mb-1 bg-green-100">
                                <video
                                  src={file}
                                  controls
                                  className="w-full h-full object-cover"
                                  title={displayName}
                                >
                                  <track kind="captions" />
                                </video>
                              </div>
                              <p className="text-xs text-green-700 truncate">{displayName}</p>
                            </div>
                          );
                        }

                        if (isAudio(file)) {
                          return (
                            <div
                              key={`${comment.id}-file-${fileIdx}`}
                              className="group p-2 rounded border border-green-200 bg-white col-span-2 sm:col-span-3"
                            >
                              <audio controls src={file} className="w-full" title={displayName}>
                                <track kind="captions" />
                              </audio>
                              <p className="text-xs text-green-700 mt-1 truncate">{displayName}</p>
                            </div>
                          );
                        }

                        return (
                          <a
                            key={`${comment.id}-file-${fileIdx}`}
                            href={file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group p-2 rounded border border-green-200 bg-white hover:bg-green-100 transition-colors flex flex-col items-center justify-center"
                          >
                            <div className="text-2xl mb-1">📎</div>
                            <p className="text-xs text-green-700 truncate text-center group-hover:text-green-900">
                              {displayName}
                            </p>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
