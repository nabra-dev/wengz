import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { applyLocale, initLocale, type AppLocale, i18n } from "../i18n";
import { LocaleContext, type LocaleContextValue, type LocaleDirection } from "./locale-context";

export type { LocaleDirection, LocaleContextValue };
export { LocaleContext };

function syncDocumentDirection(locale: AppLocale, direction: LocaleDirection) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  document.documentElement.setAttribute("dir", direction);
  document.documentElement.setAttribute("lang", locale);
  document.body?.setAttribute("dir", direction);
}

export function AppLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(i18n.locale === "ar" ? "ar" : "en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void initLocale().then(({ locale: next, reloading }) => {
      setLocaleState(next);
      // Keep the splash up while the app reloads into native RTL.
      if (!reloading) {
        setReady(true);
        void SplashScreen.hideAsync();
      }
    });
  }, []);

  const direction: LocaleDirection = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (!ready) return;
    syncDocumentDirection(locale, direction);
  }, [ready, locale, direction]);

  const setLocale = useCallback(async (next: AppLocale) => {
    syncDocumentDirection(next, next === "ar" ? "rtl" : "ltr");
    setLocaleState(next);
    await applyLocale(next);
  }, []);

  const value = useMemo(() => ({ locale, direction, setLocale }), [locale, direction, setLocale]);

  // Null keeps the native splash visible (no spinner flash).
  if (!ready) return null;

  /*
    No `direction` style wrapper here on purpose. Mirroring is owned by
    `src/rtl` (native I18nManager, or explicit row-reverse in manual mode).
  */
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** @deprecated Use AppLocaleProvider */
export const LocaleProvider = AppLocaleProvider;

export function useLocale(): LocaleContextValue {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within AppLocaleProvider");
  }
  return ctx;
}
