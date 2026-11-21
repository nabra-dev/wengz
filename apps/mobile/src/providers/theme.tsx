import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, StatusBar as RNStatusBar } from "react-native";
import { StatusBar } from "expo-status-bar";
import { getStoredColorScheme, setStoredColorScheme } from "../lib/theme-store";
import { paletteFor, type ColorScheme, type ThemeColors } from "../theme/palettes";
import { setRuntimePalette } from "../theme/runtime";

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: ThemeColors;
  isDark: boolean;
  setScheme: (next: ColorScheme) => void;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemScheme(): ColorScheme {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(systemScheme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void getStoredColorScheme().then((stored) => {
      if (stored) setSchemeState(stored);
      setReady(true);
    });
  }, []);

  const colors = useMemo(() => paletteFor(scheme), [scheme]);
  const isDark = scheme === "dark";

  useEffect(() => {
    setRuntimePalette(colors);
  }, [colors]);

  const setScheme = useCallback((next: ColorScheme) => {
    const nextColors = paletteFor(next);
    setRuntimePalette(nextColors);
    setSchemeState(next);
    void setStoredColorScheme(next);
  }, []);

  const toggleScheme = useCallback(() => {
    setSchemeState((prev) => {
      const next: ColorScheme = prev === "light" ? "dark" : "light";
      setRuntimePalette(paletteFor(next));
      void setStoredColorScheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ scheme, colors, isDark, setScheme, toggleScheme }),
    [scheme, colors, isDark, setScheme, toggleScheme]
  );

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RNStatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
