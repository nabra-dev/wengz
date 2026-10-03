import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "wengz_debug_ui_v2";

export type DebugUiFlags = {
  /** Red borders on Screen / Card / Button / Field / dropdown / attachments */
  outlines: boolean;
  /** Floating HUD with locale, route, window size, I18nManager */
  hud: boolean;
  /** console.warn when a probed view is wider than the window */
  overflowWarn: boolean;
};

const DEFAULTS: DebugUiFlags = {
  outlines: false,
  hud: false,
  overflowWarn: false,
};

export async function loadDebugFlags(): Promise<DebugUiFlags> {
  if (!__DEV__) return { outlines: false, hud: false, overflowWarn: false };
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DebugUiFlags>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveDebugFlags(flags: DebugUiFlags): Promise<void> {
  if (!__DEV__) return;
  await AsyncStorage.setItem(KEY, JSON.stringify(flags));
}
