"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AttributeResponse, ServiceAttribute } from "@/types/service-attributes";
import { resolveLocalizedText } from "@/lib/i18n";
import { useTranslations, useLocale } from "next-intl";
import { calculateAttributeCreditBreakdown } from "@/lib/attribute-validation";

interface AttributeResponsesDisplayProps {
  readonly responses: AttributeResponse[];
  readonly serviceAttributes?: ServiceAttribute[] | null;
}

const AUDIO_EXTENSIONS = new Set(["webm", "mp3", "mpeg", "ogg", "wav", "m4a", "aac", "mp4"]);

function getExtension(url: string): string {
  try {
    const clean = url.split("?")[0] ?? url;
    const parts = clean.split(".");
    return parts.length > 1 ? (parts.pop() || "").toLowerCase() : "";
  } catch {
    return "";
  }
}

function isUploadUrl(value: string): boolean {
  return value.includes("/api/files/");
}

function isAudioUrl(url: string): boolean {
  const ext = getExtension(url);
  if (AUDIO_EXTENSIONS.has(ext)) return true;
  // Common voice recording name pattern
  return /voice[-_]?(note|)\d*\.webm/i.test(url) || url.toLowerCase().includes("audio");
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

function MediaAnswerItem({ url }: { readonly url: string }) {
  if (isAudioUrl(url)) {
    return (
      <div className="space-y-1 rounded-md border bg-muted/30 p-2">
        <p className="truncate text-xs text-muted-foreground">{filenameFromUrl(url)}</p>
        <audio controls src={url} className="h-8 w-full max-w-md" preload="metadata" />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center truncate text-sm text-primary underline-offset-2 hover:underline"
    >
      {filenameFromUrl(url)}
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
    return (
      <div className="flex flex-col gap-2">
        {values.map((item) =>
          typeof item === "string" && isUploadUrl(item) ? (
            <MediaAnswerItem key={item} url={item} />
          ) : (
            <Badge key={String(item)} variant="secondary">
              {String(item)}
            </Badge>
          )
        )}
      </div>
    );
  }

  if (Array.isArray(answer)) {
    return (
      <div className="flex flex-wrap gap-2">
        {answer.map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>
    );
  }

  return <p className="text-foreground">{answer}</p>;
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

  // Build a quick map of per-question costs
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
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {responses.map((response, index) => {
            const attr = getAttribute(response, index);
            return (
              <div key={`${response.question}-${index}`} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {getQuestion(response, index)}
                  </p>
                  {typeof costMap.get(response.question) === "number" &&
                    (costMap.get(response.question) as number) > 0 && (
                      <span className="text-xs font-medium">
                        +{costMap.get(response.question)}{" "}
                        {(costMap.get(response.question) as number) === 1
                          ? t("credit")
                          : t("credits")}
                      </span>
                    )}
                </div>
                <div className="text-sm">
                  <AnswerContent answer={response.answer} attributeType={attr?.type} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
