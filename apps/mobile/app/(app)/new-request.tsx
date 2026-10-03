import { Redirect } from "expo-router";

/** Tab slot only — center button navigates to create; this is a safety redirect. */
export default function NewRequestTabSlot() {
  return <Redirect href="/requests/create" />;
}
