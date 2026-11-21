import { BRAND } from "./brand";

export type ColorScheme = "light" | "dark";

export type ThemeColors = {
  purple: string;
  yellow: string;
  background: string;
  card: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  destructive: string;
  success: string;
  warning: string;
  /** Soft chip / skip pill background */
  chip: string;
  /** Progress track under the lime fill */
  track: string;
};

export const darkPalette: ThemeColors = {
  ...BRAND.colors,
  chip: "rgba(255,255,255,0.08)",
  track: "rgba(255,255,255,0.12)",
};

export const lightPalette: ThemeColors = {
  purple: BRAND.colors.purple,
  yellow: BRAND.colors.yellow,
  background: "#FFFFFF",
  card: "#F2F0FF",
  foreground: "#111111",
  muted: "#F0EEF4",
  mutedForeground: "#6B6575",
  border: "#E4E2EA",
  destructive: BRAND.colors.destructive,
  success: BRAND.colors.success,
  warning: BRAND.colors.warning,
  chip: "#EFEFF3",
  track: "#E8E6EF",
};

export function paletteFor(scheme: ColorScheme): ThemeColors {
  return scheme === "light" ? lightPalette : darkPalette;
}
