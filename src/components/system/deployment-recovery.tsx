"use client";

import { useEffect } from "react";

const RELOAD_KEY = "wengz:deployment-reload";
const RELOAD_TTL_MS = 30_000;

function isStaleAssetError(input: unknown): boolean {
  const message =
    typeof input === "string"
      ? input
      : input instanceof Error
        ? `${input.name} ${input.message}`
        : typeof input === "object" && input !== null && "message" in input
          ? String((input as { message: unknown }).message)
          : "";
  const name =
    input instanceof Error
      ? input.name
      : typeof input === "object" && input !== null && "name" in input
        ? String((input as { name: unknown }).name)
        : "";

  const haystack = `${name} ${message}`.toLowerCase();
  return (
    name === "ChunkLoadError" ||
    haystack.includes("loading chunk") ||
    haystack.includes("loading css chunk") ||
    haystack.includes("failed to fetch dynamically imported module") ||
    haystack.includes("importing a module script failed") ||
    haystack.includes("error loading statically imported module") ||
    /\/_next\/static\//.test(message)
  );
}

function recentlyReloaded(): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < RELOAD_TTL_MS;
  } catch {
    return false;
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // ignore quota / private mode
  }
}

function clearReloadMark(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // ignore
  }
}

/**
 * Recover from post-deploy breakage: stale PWA/Next chunks, CSS missing, or a
 * new service worker taking over mid-session. Reloads at most once per 30s.
 */
export function DeploymentRecovery() {
  useEffect(() => {
    // Successful boot after a recovery reload — clear the guard.
    const bootTimer = window.setTimeout(() => {
      if (recentlyReloaded()) clearReloadMark();
    }, 4_000);

    const reloadOnce = () => {
      if (recentlyReloaded()) return;
      markReloaded();
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      const filename = event.filename || "";
      if (
        isStaleAssetError(event.error) ||
        isStaleAssetError(event.message) ||
        filename.includes("/_next/static/")
      ) {
        reloadOnce();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleAssetError(event.reason)) {
        reloadOnce();
      }
    };

    const onControllerChange = () => {
      // New SW activated after deploy — hard reload so clients drop stale assets.
      reloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    let swCleanup: (() => void) | undefined;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      swCleanup = () => {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      };
    }

    return () => {
      window.clearTimeout(bootTimer);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      swCleanup?.();
    };
  }, []);

  return null;
}
