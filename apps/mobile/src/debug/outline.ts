import type { ViewStyle } from "react-native";

/** Apply when debug outlines are on — neon border so overflow / shrink is obvious. */
export function debugOutlineStyle(
  enabled: boolean,
  color = "rgba(255,45,85,0.85)"
): ViewStyle | undefined {
  if (!enabled) return undefined;
  return {
    borderWidth: 1,
    borderColor: color,
  };
}
