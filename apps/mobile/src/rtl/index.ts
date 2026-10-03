import { I18nManager, Platform, type TextStyle, type ViewStyle } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Single source of truth for RTL.
 *
 * Exactly one mechanism is active at a time:
 *
 * - `native`: `I18nManager.isRTL` is true, so the platform mirrors rows, insets
 *   and natural text alignment. UI code must NOT add `direction`,
 *   `row-reverse` or `textAlign: right` — that would double-flip.
 * - `manual`: native RTL could not be applied (some Expo Go builds). UI code
 *   mirrors explicitly with `row-reverse` + physical `textAlign`.
 * - `web`: the `dir` attribute on `<html>` does the work.
 *
 * Never use the RN `direction` style: it is only partially honoured on iOS and
 * was the root cause of the mixed-alignment bugs.
 */
export type RtlMode = "native" | "manual" | "web";

const ATTEMPT_KEY = "wengz_rtl_force_attempt_v1";

let mode: RtlMode = Platform.OS === "web" ? "web" : "native";
let rtl = false;

export function isRtl(): boolean {
  return rtl;
}

export function getRtlMode(): RtlMode {
  return mode;
}

/** True only when UI code has to mirror by hand. */
export function manualMirror(): boolean {
  return rtl && mode === "manual";
}

export type RtlSyncResult = {
  /** Caller must reload the app so native RTL takes effect. */
  needsReload: boolean;
};

/**
 * Align the platform with `locale`.
 *
 * Tries native RTL once per locale; if `isRTL` still disagrees after that
 * reload, we stop trying and fall back to manual mirroring so the app can
 * never get stuck in a reload loop.
 */
export async function syncRtlForLocale(locale: "en" | "ar"): Promise<RtlSyncResult> {
  const desired = locale === "ar";
  rtl = desired;

  if (Platform.OS === "web") {
    mode = "web";
    return { needsReload: false };
  }

  try {
    I18nManager.allowRTL(true);
    I18nManager.swapLeftAndRightInRTL(true);

    if (I18nManager.isRTL === desired) {
      mode = "native";
      await AsyncStorage.removeItem(ATTEMPT_KEY);
      return { needsReload: false };
    }

    const attempted = await AsyncStorage.getItem(ATTEMPT_KEY);
    if (attempted === locale) {
      // forceRTL did not stick in this runtime — mirror by hand instead.
      mode = "manual";
      return { needsReload: false };
    }

    await AsyncStorage.setItem(ATTEMPT_KEY, locale);
    I18nManager.forceRTL(desired);
    return { needsReload: true };
  } catch {
    mode = "manual";
    return { needsReload: false };
  }
}

/* ---------------------------------------------------------------------------
 * Style helpers — all no-ops under native RTL.
 * ------------------------------------------------------------------------- */

/** Row that reads start → end. */
export function row(): ViewStyle {
  return { flexDirection: manualMirror() ? "row-reverse" : "row" };
}

/**
 * Row that stays physically left → right in every locale — for media
 * transports, timestamps and chat bubble rails. Under native RTL this has to
 * be `row-reverse` to cancel the platform mirroring.
 */
export function physicalRow(): ViewStyle {
  return { flexDirection: rtl && mode === "native" ? "row-reverse" : "row" };
}

/** Physical alignment for the start edge; `undefined` lets iOS use natural. */
export function startTextAlign(): TextStyle["textAlign"] {
  return manualMirror() ? "right" : undefined;
}

/** `alignItems` / `alignSelf` value meaning "start edge". */
export function alignStart(): Extract<ViewStyle["alignItems"], "flex-start" | "flex-end"> {
  return manualMirror() ? "flex-end" : "flex-start";
}

/** `justifyContent` value meaning "start edge". */
export function justifyStart(): Extract<ViewStyle["justifyContent"], "flex-start" | "flex-end"> {
  return manualMirror() ? "flex-end" : "flex-start";
}

/** Chevron / arrow glyph suffix for "forward" in the reading direction. */
export function forwardChevron(): "chevron-forward" | "chevron-back" {
  return rtl ? "chevron-back" : "chevron-forward";
}

export function backChevron(): "chevron-forward" | "chevron-back" {
  return rtl ? "chevron-forward" : "chevron-back";
}
