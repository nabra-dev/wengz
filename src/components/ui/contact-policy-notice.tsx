"use client";

import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  findContactLeaks,
  findContactLeaksInFields,
  type ContactLeakMode,
  type ContactLeakScanInput,
} from "@/lib/contact-leak";

type ContactPolicyNoticeProps = {
  readonly text?: string;
  readonly mode?: ContactLeakMode;
  readonly fields?: ContactLeakScanInput;
  readonly className?: string;
};

/**
 * Live client-side hint when typed content would be blocked for off-platform contact.
 * Server enforcement remains authoritative.
 */
export function ContactPolicyNotice({
  text,
  mode = "strict",
  fields,
  className,
}: ContactPolicyNoticeProps) {
  const t = useTranslations("errors");
  const hits = fields ? findContactLeaksInFields(fields) : text ? findContactLeaks(text, mode) : [];

  if (hits.length === 0) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100",
        className
      )}
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>{t("contactNotAllowed")}</p>
    </div>
  );
}
