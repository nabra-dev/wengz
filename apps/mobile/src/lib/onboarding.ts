import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "wengz_onboarding_done_v3";

/** Always open the 3-page splash, even after it was completed or a session exists. */
export const FORCE_ONBOARDING = true;

let forcedThisSession = false;

export function shouldForceOnboarding(): boolean {
  return FORCE_ONBOARDING && !forcedThisSession;
}

/** Call once the splash is on screen so leaving it does not bounce back. */
export function consumeForceOnboarding(): void {
  forcedThisSession = true;
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, "1");
  } catch {
    // ignore storage errors
  }
}
