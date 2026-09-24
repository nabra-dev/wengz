"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_DISPLAY_CURRENCY,
  DISPLAY_CURRENCY_STORAGE_KEY,
  type DisplayCurrency,
  isDisplayCurrency,
} from "@/lib/display-currency";

const DISPLAY_CURRENCY_EVENT = "wengz-display-currency-change";

type DisplayCurrencyContextValue = {
  currency: DisplayCurrency;
  setCurrency: (currency: DisplayCurrency) => void;
  toggleCurrency: () => void;
};

const DisplayCurrencyContext = createContext<DisplayCurrencyContextValue | null>(
  null
);

function readStoredCurrency(): DisplayCurrency {
  if (typeof window === "undefined") return DEFAULT_DISPLAY_CURRENCY;
  try {
    const stored = window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY);
    if (isDisplayCurrency(stored)) return stored;
  } catch {
    // ignore storage errors
  }
  return DEFAULT_DISPLAY_CURRENCY;
}

function subscribe(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === DISPLAY_CURRENCY_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(DISPLAY_CURRENCY_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DISPLAY_CURRENCY_EVENT, onStoreChange);
  };
}

function notifyCurrencyChange() {
  window.dispatchEvent(new Event(DISPLAY_CURRENCY_EVENT));
}

export function DisplayCurrencyProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const currency = useSyncExternalStore(
    subscribe,
    readStoredCurrency,
    () => DEFAULT_DISPLAY_CURRENCY
  );

  const setCurrency = useCallback((next: DisplayCurrency) => {
    try {
      window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    notifyCurrencyChange();
  }, []);

  const toggleCurrency = useCallback(() => {
    setCurrency(currency === "USD" ? "EGP" : "USD");
  }, [currency, setCurrency]);

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      toggleCurrency,
    }),
    [currency, setCurrency, toggleCurrency]
  );

  return (
    <DisplayCurrencyContext.Provider value={value}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency() {
  const ctx = useContext(DisplayCurrencyContext);
  if (!ctx) {
    throw new Error("useDisplayCurrency must be used within DisplayCurrencyProvider");
  }
  return ctx;
}
