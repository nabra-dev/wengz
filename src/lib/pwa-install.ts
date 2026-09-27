/**
 * Captures Chromium's `beforeinstallprompt` so a UI control can trigger the
 * native install sheet directly (no custom steps dialog).
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Outcome = "accepted" | "dismissed" | "unavailable" | "installed";

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let captureStarted = false;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export function isPwaInstalled(): boolean {
  if (globalThis.window === undefined) return false;
  return (
    globalThis.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag
    Boolean((globalThis.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function canPromptPwaInstall(): boolean {
  return deferredPrompt !== null && !isPwaInstalled();
}

export function subscribePwaInstall(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Idempotent — safe to call from layout + landing. */
export function startPwaInstallCapture(): () => void {
  if (globalThis.window === undefined || captureStarted) {
    return () => undefined;
  }
  captureStarted = true;

  const onBeforeInstall = (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  };

  const onAppInstalled = () => {
    deferredPrompt = null;
    notify();
  };

  globalThis.addEventListener("beforeinstallprompt", onBeforeInstall);
  globalThis.addEventListener("appinstalled", onAppInstalled);

  return () => {
    globalThis.removeEventListener("beforeinstallprompt", onBeforeInstall);
    globalThis.removeEventListener("appinstalled", onAppInstalled);
    captureStarted = false;
  };
}

/** Opens the browser’s native install UI when available. */
export async function promptPwaInstall(): Promise<Outcome> {
  if (isPwaInstalled()) return "installed";
  if (!deferredPrompt) return "unavailable";

  const promptEvent = deferredPrompt;
  await promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  deferredPrompt = null;
  notify();
  return outcome;
}
