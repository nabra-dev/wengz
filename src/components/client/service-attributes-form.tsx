"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { VoiceRecorder } from "@/components/ui/voice-recorder";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { UPLOAD_ACCEPT_ATTR } from "@/lib/upload-limits";
import type { ServiceAttribute, AttributeResponse } from "@/types/service-attributes";
import { resolveAttributeMaxFiles, resolveAttributeMaxSizeMB } from "@/types/service-attributes";

interface ServiceAttributesFormProps {
  readonly attributes: ServiceAttribute[];
  readonly responses: AttributeResponse[];
  readonly onChange: (responses: AttributeResponse[]) => void;
  readonly disabled?: boolean;
  readonly showErrors?: boolean;
  readonly fieldErrors?: Record<string, string>;
  readonly onFieldBlur?: (question: string) => void;
  readonly onFieldChange?: (question: string, answer: string | string[]) => void;
}

function isAnswerEmpty(answer: string | string[] | undefined): boolean {
  if (answer === undefined || answer === null) return true;
  if (typeof answer === "string") return answer.trim() === "";
  return answer.length === 0;
}

function urlsFromAnswer(answer: string | string[]): string[] {
  if (Array.isArray(answer)) return answer.filter((u) => typeof u === "string" && u.trim());
  if (typeof answer === "string" && answer.trim()) return [answer.trim()];
  return [];
}

function answerFromUrls(urls: string[], maxFiles: number): string | string[] {
  if (maxFiles <= 1) return urls[0] ?? "";
  return urls;
}

export function ServiceAttributesForm({
  attributes,
  responses,
  onChange,
  disabled = false,
  showErrors = false,
  fieldErrors = {},
  onFieldBlur,
  onFieldChange,
}: ServiceAttributesFormProps) {
  const t = useTranslations("client.newRequest.serviceQuestions");
  const locale = useLocale();

  if (!attributes || attributes.length === 0) {
    return null;
  }

  const updateResponse = (question: string, answer: string | string[]) => {
    const existingIndex = responses.findIndex((r) => r.question === question);
    const newResponses = [...responses];

    if (existingIndex >= 0) {
      newResponses[existingIndex] = { question, answer };
    } else {
      newResponses.push({ question, answer });
    }

    onChange(newResponses);
    onFieldChange?.(question, answer);
  };

  const getResponse = (question: string): string | string[] => {
    const response = responses.find((r) => r.question === question);
    return response?.answer || "";
  };

  const toggleMultiselectOption = (question: string, option: string) => {
    const currentAnswer = getResponse(question);
    const currentArray = Array.isArray(currentAnswer) ? currentAnswer : [];

    const newArray = currentArray.includes(option)
      ? currentArray.filter((o) => o !== option)
      : [...currentArray, option];

    updateResponse(question, newArray);
  };

  const getOptionsWithCosts = (attr: ServiceAttribute) => {
    if (attr.optionsWithCost && attr.optionsWithCost.length > 0) return attr.optionsWithCost;
    return (attr.options || []).map((value) => ({ value, creditCost: attr.creditImpact }));
  };

  const formatOptionLabel = (option: { value: string; creditCost?: number }) => {
    const base = option.value;
    if (option.creditCost && option.creditCost > 0) {
      return `${base} • +${option.creditCost} ${t("credit")}`;
    }
    return base;
  };

  const getCreditCostLabel = (attr: ServiceAttribute): string | null => {
    if (!attr.creditImpact || attr.creditImpact === 0) return null;
    if (attr.type === "file" || attr.type === "voice") return null;

    const unit = attr.type === "select" ? t("selection") : t("unit");

    if (attr.type === "number" && attr.includedQuantity !== undefined) {
      return t("extraCostWithIncluded", {
        cost: attr.creditImpact,
        unit,
        included: attr.includedQuantity,
      });
    }

    return t("extraCost", {
      cost: attr.creditImpact,
      unit,
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">{t("title")}</h3>
        <p className="text-sm text-muted-foreground mb-6">{t("description")}</p>

        <div className="space-y-6">
          {attributes.map((attr, index) => {
            const creditCostLabel = getCreditCostLabel(attr);
            const answer = getResponse(attr.question);
            const errorFromParent = fieldErrors[attr.question];
            const localRequiredError =
              showErrors && attr.required && isAnswerEmpty(answer) ? t("required") : null;
            const error = errorFromParent || localRequiredError;
            const invalid = !!error;
            const maxFiles = resolveAttributeMaxFiles(attr);
            const maxSizeMB = resolveAttributeMaxSizeMB(attr);

            return (
              <div key={`${attr.question}-${index}`} className="space-y-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor={`attr-${index}`} className="flex items-center gap-1 min-w-0">
                    {resolveLocalizedText((attr as any).questionI18n, locale, attr.question)}
                    {attr.required && (
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    )}
                  </Label>
                  {creditCostLabel && (
                    <span className="shrink-0 self-start text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                      {creditCostLabel}
                    </span>
                  )}
                </div>

                {(attr.helpText || (attr as any).helpTextI18n) && (
                  <p className="text-xs text-muted-foreground">
                    {resolveLocalizedText((attr as any).helpTextI18n, locale, attr.helpText)}
                  </p>
                )}

                {attr.type === "text" && (
                  <Input
                    id={`attr-${index}`}
                    placeholder={resolveLocalizedText(
                      (attr as any).placeholderI18n,
                      locale,
                      attr.placeholder
                    )}
                    value={(answer as string) || ""}
                    onChange={(e) => updateResponse(attr.question, e.target.value)}
                    onBlur={() => onFieldBlur?.(attr.question)}
                    required={attr.required}
                    disabled={disabled}
                    aria-invalid={invalid}
                    className={cn(invalid && "border-destructive focus-visible:ring-destructive")}
                  />
                )}

                {attr.type === "textarea" && (
                  <Textarea
                    id={`attr-${index}`}
                    placeholder={resolveLocalizedText(
                      (attr as any).placeholderI18n,
                      locale,
                      attr.placeholder
                    )}
                    value={(answer as string) || ""}
                    onChange={(e) => updateResponse(attr.question, e.target.value)}
                    onBlur={() => onFieldBlur?.(attr.question)}
                    required={attr.required}
                    disabled={disabled}
                    rows={4}
                    aria-invalid={invalid}
                    className={cn(invalid && "border-destructive focus-visible:ring-destructive")}
                  />
                )}

                {attr.type === "number" && (
                  <Input
                    id={`attr-${index}`}
                    type="number"
                    placeholder={resolveLocalizedText(
                      (attr as any).placeholderI18n,
                      locale,
                      attr.placeholder
                    )}
                    value={(answer as string) || ""}
                    onChange={(e) => updateResponse(attr.question, e.target.value)}
                    onBlur={() => onFieldBlur?.(attr.question)}
                    required={attr.required}
                    disabled={disabled}
                    min={attr.min}
                    max={attr.max}
                    aria-invalid={invalid}
                    className={cn(invalid && "border-destructive focus-visible:ring-destructive")}
                  />
                )}

                {attr.type === "select" && (
                  <Select
                    value={(answer as string) || ""}
                    onValueChange={(value) => updateResponse(attr.question, value)}
                    disabled={disabled}
                    required={attr.required}
                  >
                    <SelectTrigger
                      id={`attr-${index}`}
                      aria-invalid={invalid}
                      className={cn(invalid && "border-destructive focus:ring-destructive")}
                      onBlur={() => onFieldBlur?.(attr.question)}
                    >
                      <SelectValue placeholder={t("selectOption")} />
                    </SelectTrigger>
                    <SelectContent>
                      {getOptionsWithCosts(attr).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {formatOptionLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {attr.type === "multiselect" && (
                  <div
                    className={cn(
                      "space-y-2 border rounded-md p-4",
                      invalid && "border-destructive"
                    )}
                    onBlur={() => onFieldBlur?.(attr.question)}
                  >
                    {getOptionsWithCosts(attr).map((option) => (
                      <div key={option.value} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`${attr.question}-${option.value}`}
                            checked={
                              Array.isArray(answer) && (answer as string[]).includes(option.value)
                            }
                            onCheckedChange={() =>
                              toggleMultiselectOption(attr.question, option.value)
                            }
                            disabled={disabled}
                          />
                          <label
                            htmlFor={`${attr.question}-${option.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {option.value}
                          </label>
                        </div>
                        {option.creditCost && option.creditCost > 0 && (
                          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                            +{option.creditCost} {t("credit")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {attr.type === "file" && (
                  <div
                    className={cn(invalid && "rounded-md ring-1 ring-destructive")}
                    onBlur={() => onFieldBlur?.(attr.question)}
                  >
                    <FileUpload
                      maxFiles={maxFiles}
                      maxSizeMB={maxSizeMB}
                      accept={UPLOAD_ACCEPT_ATTR}
                      disabled={disabled}
                      onFilesChange={(files: UploadedFile[]) => {
                        const urls = files.map((f) => f.url);
                        updateResponse(attr.question, answerFromUrls(urls, maxFiles));
                      }}
                    />
                  </div>
                )}

                {attr.type === "voice" && (
                  <div
                    className={cn(invalid && "rounded-md ring-1 ring-destructive")}
                    onBlur={() => onFieldBlur?.(attr.question)}
                  >
                    <VoiceRecorder
                      value={urlsFromAnswer(answer)}
                      maxFiles={maxFiles}
                      maxSizeMB={maxSizeMB}
                      disabled={disabled}
                      onChange={(urls) =>
                        updateResponse(attr.question, answerFromUrls(urls, maxFiles))
                      }
                    />
                  </div>
                )}

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
