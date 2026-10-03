import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { applyLocale, initLocale, type AppLocale, i18n } from "../i18n";
import { Loading } from "../components/ui";

export type LocaleDirection = "ltr" | "rtl";

type LocaleContextValue = {
  locale: AppLocale;
  direction: LocaleDirection;
  setLocale: (locale: AppLocale) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

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
    void initLocale().then((next) => {
      setLocaleState(next);
      setReady(true);
    });
  }, []);

  const direction: LocaleDirection = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (!ready) return;
    syncDocumentDirection(locale, direction);
  }, [ready, locale, direction]);

  const setLocale = useCallback(async (next: AppLocale) => {
    const nextDir: LocaleDirection = next === "ar" ? "rtl" : "ltr";
    syncDocumentDirection(next, nextDir);
    await applyLocale(next, { reload: true });
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, direction, setLocale }), [locale, direction, setLocale]);

  if (!ready) return <Loading />;

  return (
    <LocaleContext.Provider value={value}>
      {/*
        Single RTL source of truth for layout:
        - Web: `dir` attribute
        - Native: RN `direction` (Expo Go often ignores I18nManager.forceRTL)
        Do not also row-reverse or read I18nManager.isRTL in UI.
      */}
      <View
        key={locale}
        style={{ flex: 1, direction }}
        {...({ dir: direction, lang: locale } as object)}
      >
        {children}
      </View>
    </LocaleContext.Provider>
  );
}

/** @deprecated Use AppLocaleProvider */
export const LocaleProvider = AppLocaleProvider;

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within AppLocaleProvider");
  }
  return ctx;
}
