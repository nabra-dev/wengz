"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

const THEME_COOKIE = "theme";
const THEME_STORAGE_KEY = "theme";

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(t);
}

function persistTheme(t: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch {
    // ignore quota / private mode
  }
  // Cookie lets the server layout paint the correct class (no blocking <script>).
  document.cookie = `${THEME_COOKIE}=${t};path=/;max-age=31536000;samesite=lax`;
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  return "dark";
}

export function ThemeProvider({
  children,
  initialTheme = "dark",
}: {
  children: React.ReactNode;
  /** From NEXT_LOCALE-safe server cookie so SSR matches client. */
  initialTheme?: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const stored = readStoredTheme();
    // Defer to avoid sync setState-in-effect lint; localStorage is external.
    queueMicrotask(() => {
      setTheme(stored);
      applyTheme(stored);
      persistTheme(stored);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      persistTheme(next);
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export type { Theme };
