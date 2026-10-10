"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const PHONE_COUNTRY_OPTIONS = [
  { value: "+20", flag: "🇪🇬", countryKey: "eg" },
  { value: "+966", flag: "🇸🇦", countryKey: "sa" },
  { value: "+971", flag: "🇦🇪", countryKey: "ae" },
  { value: "+965", flag: "🇰🇼", countryKey: "kw" },
] as const;

type PhoneCountrySelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function PhoneCountrySelect({
  value,
  onValueChange,
  disabled,
  className,
  triggerClassName,
}: PhoneCountrySelectProps) {
  const t = useTranslations("forms.fields.countries");

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled} dir="ltr">
      <SelectTrigger
        className={cn(
          "h-12 w-[7.25rem] shrink-0 gap-1.5 rounded-xl border-border/70 bg-background/80 px-2 shadow-sm focus:ring-2 focus:ring-primary/20 [&>span]:line-clamp-none sm:w-[9.5rem] sm:gap-2 sm:px-3",
          triggerClassName
        )}
      >
        <SelectValue placeholder="🇪🇬 +20" />
      </SelectTrigger>
      <SelectContent
        align="start"
        position="popper"
        className={cn(
          "z-[100] min-w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-xl border-border/70 p-1 shadow-xl",
          className
        )}
      >
        {PHONE_COUNTRY_OPTIONS.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            textValue={`${option.value} ${t(option.countryKey)}`}
            label={t(option.countryKey)}
            className="cursor-pointer rounded-lg py-2.5 ps-9 pe-3"
          >
            <span className="inline-flex items-center gap-2.5">
              <span className="text-base leading-none">{option.flag}</span>
              <span className="font-medium tabular-nums tracking-wide">{option.value}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
