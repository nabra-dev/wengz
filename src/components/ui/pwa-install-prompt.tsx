"use client";

import { useEffect } from "react";
import { startPwaInstallCapture } from "@/lib/pwa-install";

/**
 * Registers the native install prompt listener early. UI lives on the landing
 * download control — no auto toast / steps dialog.
 */
export function PWAInstallPrompt() {
  useEffect(() => startPwaInstallCapture(), []);
  return null;
}
