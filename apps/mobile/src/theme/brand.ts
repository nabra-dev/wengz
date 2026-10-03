import { i18n } from "../i18n";

/** Mirrors `src/lib/brand.ts` + `globals.css` dark tokens. */
export const BRAND = {
  name: "Wengz",
  nameAr: "وينجز",
  colors: {
    purple: "#690DD4",
    yellow: "#E0F840",
    background: "#0E0A14",
    card: "#15101F",
    foreground: "#F5F7E8",
    muted: "#231C2E",
    mutedForeground: "#A89FB5",
    border: "#2E2740",
    destructive: "#EF4444",
    success: "#22C55E",
    warning: "#F59E0B",
  },
} as const;

type FontRoles = {
  regular: string;
  medium: string;
  semiBold: string;
  bold: string;
};

/** Latin display face — brand wordmark / EN UI. */
export const latinFonts: FontRoles = {
  regular: "Unbounded_400Regular",
  medium: "Unbounded_500Medium",
  semiBold: "Unbounded_600SemiBold",
  bold: "Unbounded_700Bold",
};

/** Arabic UI face — Unbounded has no Arabic glyphs. */
export const arabicFonts: FontRoles = {
  regular: "Cairo_400Regular",
  medium: "Cairo_500Medium",
  semiBold: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
};

function activeFonts(): FontRoles {
  return i18n.locale === "ar" ? arabicFonts : latinFonts;
}

/**
 * Locale-aware font roles. Always read at render time (not inside StyleSheet.create),
 * so Arabic switches to Cairo instead of falling back from Unbounded.
 */
export const fonts: FontRoles & { cairo: string; cairoBold: string } = new Proxy(
  {} as FontRoles & { cairo: string; cairoBold: string },
  {
    get(_target, prop: string) {
      if (prop === "cairo") return arabicFonts.regular;
      if (prop === "cairoBold") return arabicFonts.bold;
      const role = activeFonts()[prop as keyof FontRoles];
      return role ?? activeFonts().regular;
    },
  }
);

const typeScaleEn = {
  xs: { fontSize: 10, lineHeight: 14 },
  sm: { fontSize: 12, lineHeight: 16 },
  md: { fontSize: 13, lineHeight: 18 },
  lg: { fontSize: 15, lineHeight: 20 },
  xl: { fontSize: 17, lineHeight: 22 },
  display: { fontSize: 22, lineHeight: 26 },
} as const;

/** Slightly taller metrics for Arabic (Cairo). */
const typeScaleAr = {
  xs: { fontSize: 11, lineHeight: 16 },
  sm: { fontSize: 13, lineHeight: 20 },
  md: { fontSize: 14, lineHeight: 22 },
  lg: { fontSize: 16, lineHeight: 24 },
  xl: { fontSize: 18, lineHeight: 26 },
  display: { fontSize: 22, lineHeight: 30 },
} as const;

export type TypeScale = typeof typeScaleEn;

/** Prefer this at render time so AR gets Cairo-friendly metrics. */
export function getTypeScale(): TypeScale {
  return (i18n.locale === "ar" ? typeScaleAr : typeScaleEn) as TypeScale;
}

/**
 * Locale-aware type scale (read at render time).
 * Spreading `...typeScale.md` in StyleSheet.create still freezes EN — use at render.
 */
export const typeScale: TypeScale = new Proxy({} as TypeScale, {
  get(_target, prop: string) {
    const scale = getTypeScale();
    return scale[prop as keyof TypeScale];
  },
});

export function statusStyle(status: string): { bg: string; fg: string } {
  const map: Record<string, { bg: string; fg: string }> = {
    PENDING: { bg: "rgba(245,158,11,0.15)", fg: "#FBBF24" },
    IN_PROGRESS: { bg: "rgba(105,13,212,0.2)", fg: "#C4A0FF" },
    DELIVERED: { bg: "rgba(224,248,64,0.15)", fg: BRAND.colors.yellow },
    REVISION_REQUESTED: { bg: "rgba(249,115,22,0.15)", fg: "#FB923C" },
    COMPLETED: { bg: "rgba(34,197,94,0.15)", fg: "#4ADE80" },
    CANCELLED: { bg: "rgba(239,68,68,0.15)", fg: "#F87171" },
  };
  return map[status] || { bg: BRAND.colors.muted, fg: BRAND.colors.mutedForeground };
}
