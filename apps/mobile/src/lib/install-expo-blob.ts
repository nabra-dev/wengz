/**
 * Install expo-blob as the global Blob so `Response.blob()` skips the slow
 * React Native Blob path (and its Expo Go console warning).
 */
import { Blob as ExpoBlob } from "expo-blob";

export function installExpoBlob(): void {
  if (typeof globalThis === "undefined") return;
  try {
    Object.defineProperty(globalThis, "Blob", {
      configurable: true,
      writable: true,
      value: ExpoBlob,
    });
  } catch {
    // Ignore if the runtime freezes Blob.
  }
}

installExpoBlob();
