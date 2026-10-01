"use client";

/* eslint-disable @next/next/no-img-element -- user-uploaded /api/files URLs */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AttributeResponse, ServiceAttribute } from "@/types/service-attributes";
import { resolveLocalizedText } from "@/lib/i18n";
import { useTranslations, useLocale } from "next-intl";
import { calculateAttributeCreditBreakdown } from "@/lib/attribute-validation";
import { AudioPlayer } from "@/components/ui/audio-player";
import { LinkifiedText } from "@/components/ui/linkified-text";
import {
  filenameFromUrl,
  getExtension,
  prettyFilename,
  resolveFileKind,
  type FileKind,
} from "@/lib/file-display";
import { cn } from "@/lib/utils";
import { FileArchive, FileAudio, FileIcon, FileText, FileVideo, ExternalLink } from "lucide-react";
import { textContainsUrl } from "@/lib/linkify";

interface AttributeResponsesDisplayProps {
  readonly responses: AttributeResponse[];
  readonly serviceAttributes?: ServiceAttribute[] | null;
}

function isUploadUrl(value: string): boolean {
  return value.includes("/api/files/");
}

function kindLabel(kind: FileKind, t: (key: string) => string): string {
  switch (kind) {
    case "image":
      return t("fileKinds.image");
    case "audio":
      return t("fileKinds.voiceNote");
    case "video":
      return t("fileKinds.video");
    case "pdf":
      return t("fileKinds.pdf");
    case "archive":
      return t("fileKinds.archive");
    default:
      return t("fileKinds.file");
  }
}

function displayNameFor(url: string, kind: FileKind, t: (key: string) => string): string {
  const raw = filenameFromUrl(url);
  const pretty = prettyFilename(raw);
  const ext = getExtension(raw);
  const label = kindLabel(kind, t);

  // prettyFilename may return only ".jpeg" when the stem was all ids
  if (!pretty || pretty.startsWith(".")) {
    return ext ? `${label}.${ext}` : label;
  }
  return pretty;
}

function FileKindIcon({
  kind,
  className,
}: {
  readonly kind: FileKind;
  readonly className?: string;
}) {
  const cls = cn("h-8 w-8", className);
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

function MediaAnswerItem({
  url,
  attributeType,
}: {
  readonly url: string;
  readonly attributeType?: ServiceAttribute["type"];
}) {
  const t = useTranslations("requests.attributes");
  const kind = resolveFileKind(url, attributeType);
  const name = displayNameFor(url, kind, t);

  if (kind === "audio") {
    return (
      <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileAudio className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground">{t("fileKinds.voiceNote")}</p>
          </div>
        </div>
        <AudioPlayer src={url} filename={name} className="w-full" />
      </div>
    );
  }

  if (kind === "image") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-lg border bg-muted/30 transition-colors hover:bg-muted/50"
      >
        <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
          <img src={url} alt={name} className="h-full w-full object-cover" />
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{name}</p>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </a>
    );
  }

  if (kind === "video") {
    return (
      <div className="overflow-hidden rounded-lg border bg-muted/30">
        <div className="aspect-video bg-muted">
          <video src={url} controls className="h-full w-full object-cover" title={name}>
            <track kind="captions" />
          </video>
        </div>
        <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{name}</p>
      </div>
    );
  }

  // PDF / archive / other — icon card
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-lg border bg-muted/40 p-3 transition-colors hover:bg-muted/60"
    >
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-md",
          kind === "pdf" && "bg-red-500/15 text-red-600 dark:text-red-400",
          kind === "archive" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
          kind === "other" && "bg-primary/10 text-primary"
        )}
      >
        <FileKindIcon kind={kind} className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{kindLabel(kind, t)}</p>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
    </a>
  );
}

function AnswerContent({
  answer,
  attributeType,
}: {
  readonly answer: string | string[];
  readonly attributeType?: ServiceAttribute["type"];
}) {
  const values = Array.isArray(answer) ? answer : [answer];
  const looksLikeMedia =
    attributeType === "file" ||
    attributeType === "voice" ||
    values.some((v) => typeof v === "string" && isUploadUrl(v));

  if (looksLikeMedia) {
    const mediaUrls = values.filter((v): v is string => typeof v === "string" && isUploadUrl(v));
    const nonMedia = values.filter((v) => typeof v !== "string" || !isUploadUrl(v));
    const allImages =
      mediaUrls.length > 0 && mediaUrls.every((u) => resolveFileKind(u, attributeType) === "image");

    return (
      <div className="space-y-2">
        {mediaUrls.length > 0 && (
          <div
            className={cn(
              allImages ? "grid grid-cols-2 sm:grid-cols-3 gap-2" : "flex flex-col gap-2"
            )}
          >
            {mediaUrls.map((item) => (
              <MediaAnswerItem key={item} url={item} attributeType={attributeType} />
            ))}
          </div>
        )}
        {nonMedia.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {nonMedia.map((item) => (
              <Badge
                key={String(item)}
                variant="secondary"
                className="max-w-full whitespace-normal"
              >
                {textContainsUrl(String(item)) ? (
                  <LinkifiedText text={String(item)} inline className="whitespace-normal" />
                ) : (
                  String(item)
                )}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (Array.isArray(answer)) {
    return (
      <div className="flex flex-wrap gap-2">
        {answer.map((item) => (
          <Badge key={item} variant="secondary" className="max-w-full whitespace-normal">
            {textContainsUrl(item) ? (
              <LinkifiedText text={item} inline className="whitespace-normal" />
            ) : (
              item
            )}
          </Badge>
        ))}
      </div>
    );
  }

  return <LinkifiedText text={answer} className="text-foreground" />;
}

export function AttributeResponsesDisplay({
  responses,
  serviceAttributes,
}: AttributeResponsesDisplayProps) {
  const t = useTranslations("requests.attributes");
  const locale = useLocale();

  if (!responses || responses.length === 0) {
    return null;
  }

  const costItems = serviceAttributes
    ? calculateAttributeCreditBreakdown(serviceAttributes, responses)
    : [];
  const costMap = new Map(costItems.map((i) => [i.question, i.cost]));

  const getAttribute = (
    response: AttributeResponse,
    index: number
  ): ServiceAttribute | undefined => {
    if (!serviceAttributes || serviceAttributes.length === 0) return undefined;
    const byIndex = serviceAttributes[index];
    const byText = serviceAttributes.find((attr) => attr.question === response.question);
    return byText || byIndex;
  };

  const getQuestion = (response: AttributeResponse, index: number): string => {
    const attr = getAttribute(response, index);
    if (!attr) return response.question;
    return resolveLocalizedText(attr.questionI18n, locale, attr.question);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border/80">
          {responses.map((response, index) => {
            const attr = getAttribute(response, index);
            const cost = costMap.get(response.question);
            return (
              <li key={`${response.question}-${index}`} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{getQuestion(response, index)}</p>
                  {typeof cost === "number" && cost > 0 && (
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      +{cost} {cost === 1 ? t("credit") : t("credits")}
                    </Badge>
                  )}
                </div>
                <AnswerContent answer={response.answer} attributeType={attr?.type} />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
