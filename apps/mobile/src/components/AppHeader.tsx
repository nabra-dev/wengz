import { View } from "react-native";
import { BrandLogo } from "./BrandLogo";

/** Centered brand mark for React Navigation headers (tabs + stacks). */
export function AppHeaderTitle() {
  return (
    <View style={{ paddingVertical: 4, alignItems: "center", justifyContent: "center" }}>
      <BrandLogo height={22} tone="yellow" />
    </View>
  );
}
