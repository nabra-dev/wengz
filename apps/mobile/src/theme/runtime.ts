import { darkPalette, type ThemeColors } from "./palettes";

/** Mutable palette — ThemeProvider writes; `colors` Proxy reads at access time. */
let current: ThemeColors = darkPalette;

export function setRuntimePalette(next: ThemeColors) {
  current = next;
}

export function getRuntimePalette(): ThemeColors {
  return current;
}

/**
 * Drop-in for `BRAND.colors` / old `colors` imports.
 * Always reflects the active scheme (safe in render; not for StyleSheet.create).
 */
export const colors: ThemeColors = new Proxy({} as ThemeColors, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== "string") return undefined;
    return current[prop as keyof ThemeColors];
  },
  ownKeys() {
    return Reflect.ownKeys(current);
  },
  getOwnPropertyDescriptor(_target, prop) {
    return {
      configurable: true,
      enumerable: true,
      value: current[prop as keyof ThemeColors],
    };
  },
});
