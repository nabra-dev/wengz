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

export const fonts = {
  regular: "Unbounded_400Regular",
  medium: "Unbounded_500Medium",
  semiBold: "Unbounded_600SemiBold",
  bold: "Unbounded_700Bold",
  cairo: "Cairo_400Regular",
  cairoBold: "Cairo_700Bold",
} as const;

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
