"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LocalizedText } from "@/types/i18n";

type Variant = "input" | "textarea";

interface LocalizedInputProps {
  readonly value?: string | LocalizedText | null;
  readonly onChange: (next: LocalizedText) => void;
  readonly variant?: Variant;
  readonly id?: string;
  /** Visible field label used for accessible names on each locale input */
  readonly label?: string;
  readonly placeholder?: string | LocalizedText;
  readonly disabled?: boolean;
  readonly required?: boolean;
  // Which locales to show as tabs; defaults to en/ar
  readonly locales?: readonly [string, string];
}

function normalize(value: string | LocalizedText | null | undefined): LocalizedText {
  if (!value) return { en: "", ar: "" };
  if (typeof value === "string") return { en: value, ar: "" };
  const en = value["en"] ?? "";
  const ar = value["ar"] ?? "";
  return { en, ar };
}

export function LocalizedInput({
  value,
  onChange,
  variant = "input",
  id,
  label,
  placeholder,
  disabled,
  required,
  locales = ["en", "ar"],
}: LocalizedInputProps) {
  const [active, setActive] = React.useState<string>(locales[0]);
  const normalized = normalize(value);

  const placeholders = normalize(placeholder ?? null);

  const handleChange = (locale: string, nextVal: string) => {
    const next: LocalizedText = { ...normalized, [locale]: nextVal };
    onChange(next);
  };

  const t = useTranslations("locales");

  return (
    <div className="relative">
      {/* Tiny tabs aligned to the logical end (LTR: right, RTL: left) */}
      <div className="absolute -top-4 ltr:right-0 rtl:left-0">
        <Tabs value={active} onValueChange={setActive}>
          <TabsList className="h-6 px-1 py-0 text-xs">
            {locales.map((loc) => (
              <TabsTrigger key={loc} value={loc} className="px-2 py-0">
                {t(loc)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Inputs per locale */}
      {locales.map((loc) => {
        const fieldId = id ? `${id}-${loc}` : undefined;
        const accessibleName = label ? `${label} (${t(loc)})` : t(loc);
        return (
          <Tabs key={loc} value={active} onValueChange={setActive}>
            <TabsContent value={loc} className="mt-1">
              {variant === "input" ? (
                <Input
                  id={fieldId}
                  name={fieldId}
                  aria-label={accessibleName}
                  placeholder={placeholders[loc]}
                  value={normalized[loc]}
                  onChange={(e) => handleChange(loc, e.target.value)}
                  disabled={disabled}
                  required={required}
                />
              ) : (
                <Textarea
                  id={fieldId}
                  name={fieldId}
                  aria-label={accessibleName}
                  placeholder={placeholders[loc]}
                  value={normalized[loc]}
                  onChange={(e) => handleChange(loc, e.target.value)}
                  disabled={disabled}
                  required={required}
                  rows={4}
                />
              )}
            </TabsContent>
          </Tabs>
        );
      })}
    </div>
  );
}
