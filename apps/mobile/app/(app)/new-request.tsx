import { View } from "react-native";

/**
 * Placeholder tab slot only. The center FAB navigates to `/requests/create`.
 * Never redirect from here — focusing this tab accidentally would open Create
 * on top of the Requests stack.
 */
export default function NewRequestTabSlot() {
  return <View style={{ flex: 1 }} />;
}
