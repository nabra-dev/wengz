"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LocalizedText } from "@/types/i18n";
import { cn } from "@/lib/utils";

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

/**
 * Bilingual text field. Locale panels stay mounted (CSS-hidden) so typing
 * does not remount the active input and steal focus after each keystroke.
 */
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
  const t = useTranslations("locales");

  const handleChange = (locale: string, nextVal: string) => {
    const next: LocalizedText = { ...normalized, [locale]: nextVal };
    onChange(next);
  };

  return (
    <div className="relative">
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

      {locales.map((loc) => {
        const fieldId = id ? `${id}-${loc}` : undefined;
        const accessibleName = label ? `${label} (${t(loc)})` : t(loc);
        const isActive = active === loc;

        return (
          <div
            key={loc}
            className={cn("mt-1", !isActive && "hidden")}
            // Keep inactive locales in the DOM so switching tabs doesn't remount inputs.
            inert={!isActive ? true : undefined}
          >
            {variant === "input" ? (
              <Input
                id={fieldId}
                name={fieldId}
                aria-label={accessibleName}
                placeholder={placeholders[loc]}
                value={normalized[loc]}
                onChange={(e) => handleChange(loc, e.target.value)}
                disabled={disabled}
                required={required && isActive}
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
                required={required && isActive}
                rows={4}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
