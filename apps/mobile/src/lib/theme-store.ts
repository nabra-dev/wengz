import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ColorScheme } from "../theme/palettes";

const KEY = "wengz_color_scheme_v1";

export async function getStoredColorScheme(): Promise<ColorScheme | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
    return null;
  } catch {
    return null;
  }
}

export async function setStoredColorScheme(scheme: ColorScheme): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, scheme);
  } catch {
    /* ignore */
  }
}
