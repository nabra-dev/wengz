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
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ServiceAttribute, AttributeResponse } from "@/types/service-attributes";

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

  const formatOptionLabel = (
    option: { value: string; creditCost?: number },
    attr: ServiceAttribute
  ) => {
    const base = option.value;
    if (option.creditCost && option.creditCost > 0) {
      return `${base} • +${option.creditCost} ${t("credit")}`;
    }
    return base;
  };

  const getCreditCostLabel = (attr: ServiceAttribute): string | null => {
    if (!attr.creditImpact || attr.creditImpact === 0) return null;

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

            return (
              <div key={`${attr.question}-${index}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`attr-${index}`} className="flex items-center gap-1">
                    {resolveLocalizedText((attr as any).questionI18n, locale, attr.question)}
                    {attr.required && (
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    )}
                  </Label>
                  {creditCostLabel && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
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
                          {formatOptionLabel(option, attr)}
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
