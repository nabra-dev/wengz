import { useSyncExternalStore } from "react";
import type { DebugUiFlags } from "./flags";

type Listener = () => void;

let flags: Pick<DebugUiFlags, "outlines" | "overflowWarn"> = {
  outlines: false,
  overflowWarn: false,
};
const listeners = new Set<Listener>();

export function publishDebugOutlineFlags(
  next: Pick<DebugUiFlags, "outlines" | "overflowWarn">
): void {
  flags = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return flags;
}

/** Safe for `ui.tsx` — no import cycle with locale / DebugProvider. */
export function useDebugOutlineFlags(): Pick<DebugUiFlags, "outlines" | "overflowWarn"> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
