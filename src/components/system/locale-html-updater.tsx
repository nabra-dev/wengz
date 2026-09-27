"use client";

import { useEffect } from "react";
import { LOCALE_SWITCH_CACHE_BUST } from "@/lib/locale-switch";

export function LocaleHtmlUpdater({ locale }: { readonly locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  // Drop one-time language-switch cache-bust query without triggering another navigation.
  useEffect(() => {
    const url = new URL(globalThis.location.href);
    if (!url.searchParams.has(LOCALE_SWITCH_CACHE_BUST)) return;
    url.searchParams.delete(LOCALE_SWITCH_CACHE_BUST);
    const clean = `${url.pathname}${url.search}${url.hash}`;
    globalThis.history.replaceState(globalThis.history.state, "", clean);
  }, []);

  return null;
}
