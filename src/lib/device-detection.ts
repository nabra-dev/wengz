/**
 * Utility functions for device detection and web notification capability
 */

export function isMobileDevice(): boolean {
  if (globalThis.window === undefined) return false;

  const userAgent = navigator.userAgent || "";

  // Check for mobile devices
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  if (mobileRegex.test(userAgent.toLowerCase())) {
    return true;
  }

  // Check for touch capability (not foolproof but helps)
  const hasTouchScreen = "maxTouchPoints" in navigator && navigator.maxTouchPoints > 0;

  // Check screen size as backup
  const isSmallScreen = globalThis.window.innerWidth <= 768;

  return hasTouchScreen && isSmallScreen;
}

export function isDesktopDevice(): boolean {
  return !isMobileDevice();
}

/** True when the app is running as an installed PWA (home-screen). */
export function isStandalonePwa(): boolean {
  if (globalThis.window === undefined) return false;

  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;

  return globalThis.window.matchMedia("(display-mode: standalone)").matches;
}

export function isIosDevice(): boolean {
  if (globalThis.window === undefined) return false;
  return /iphone|ipod|ipad/i.test(navigator.userAgent.toLowerCase());
}

export function isAndroidDevice(): boolean {
  if (globalThis.window === undefined) return false;
  return /android/i.test(navigator.userAgent.toLowerCase());
}

/**
 * Whether the platform can show system notification prompts usefully.
 * - Desktop: yes
 * - Android Chrome: yes
 * - iOS: only installed PWA (Safari tabs cannot prompt reliably)
 */
export function supportsWebNotifications(): boolean {
  if (globalThis.window === undefined) return false;
  if (!("Notification" in globalThis.window)) return false;

  if (isIosDevice()) {
    return isStandalonePwa();
  }

  return true;
}

/** @deprecated Prefer supportsWebNotifications */
export function supportsDesktopNotifications(): boolean {
  return supportsWebNotifications();
}

export function getBrowserName(): string {
  if (globalThis.window === undefined) return "unknown";

  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("firefox")) return "Firefox";
  if (userAgent.includes("chrome") && !userAgent.includes("edg")) return "Chrome";
  if (userAgent.includes("safari") && !userAgent.includes("chrome")) return "Safari";
  if (userAgent.includes("edg")) return "Edge";
  if (userAgent.includes("opera") || userAgent.includes("opr")) return "Opera";

  return "Unknown";
}
