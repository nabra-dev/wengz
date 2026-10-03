import { Redirect, useIsFocused } from "expo-router";
import { Loading } from "../../src/components/ui";

/**
 * Placeholder tab slot for the center FAB, which normally navigates straight to
 * `/requests/create`.
 *
 * It used to render an empty View, so any path that *did* focus this tab (deep
 * link, state restore, stray tab press) showed a blank screen. Redirect instead
 * — guarded by `useIsFocused` so the mounted-but-inactive tab never navigates.
 */
export default function NewRequestTabSlot() {
  const focused = useIsFocused();
  if (focused) return <Redirect href="/requests/create" />;
  return <Loading />;
}
