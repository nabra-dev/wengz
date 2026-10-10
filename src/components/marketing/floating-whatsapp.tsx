"use client";

import { usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";

export const WHATSAPP_HREF = "https://wa.me/201018249632";
export const WHATSAPP_DISPLAY = "+20 101 824 9632";

/** Dashboard shells keep their own chrome — floating WA is for marketing/public only. */
function isPublicMarketingPath(pathname: string): boolean {
  const first = pathname.split("/").filter(Boolean)[0] ?? "";
  return first !== "client" && first !== "provider" && first !== "admin";
}

export function FloatingWhatsApp() {
  const pathname = usePathname() || "/";
  const t = useTranslations("landing.footer");

  if (!isPublicMarketingPath(pathname)) return null;

  return (
    <a
      href={WHATSAPP_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsapp")}
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] end-[max(1.25rem,env(safe-area-inset-right))] z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_28px_rgba(37,211,102,0.45)] transition hover:scale-[1.04] hover:bg-[#1ebe57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-7 w-7">
        <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.59 2 2.15 6.44 2.15 11.89c0 1.75.46 3.45 1.32 4.95L2.05 22l5.3-1.39a9.84 9.84 0 0 0 4.69 1.19h.01c5.45 0 9.89-4.44 9.89-9.89 0-2.64-1.03-5.12-2.89-6.99Zm-7.01 15.22h-.01a8.17 8.17 0 0 1-4.16-1.14l-.3-.18-3.14.82.84-3.06-.2-.31a8.16 8.16 0 0 1-1.26-4.37c0-4.52 3.68-8.2 8.21-8.2 2.19 0 4.25.86 5.8 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.18 8.2Zm4.49-6.13c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.12-.16.25-.63.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.74 2.66 4.22 3.73.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.17.21-.58.21-1.07.14-1.17-.06-.11-.23-.18-.48-.3Z" />
      </svg>
    </a>
  );
}
