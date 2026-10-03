import { View } from "react-native";
import { BrandLogo } from "./BrandLogo";
import { BRAND, latinFonts, typeScale } from "../theme/brand";
import { colors } from "./ui";
import { AppText } from "./typography";

/** Shared auth / marketing identity block — logo + brand name. */
export function AuthBrand({
  height = 48,
  showName = false,
}: {
  height?: number;
  showName?: boolean;
}) {
  return (
    <View style={{ alignItems: "center", marginBottom: 28 }}>
      <BrandLogo height={height} tone="yellow" />
      {showName ? (
        <AppText
          style={{
            marginTop: 12,
            color: colors.foreground,
            // Always Unbounded for the Latin wordmark, even in AR UI.
            fontFamily: latinFonts.semiBold,
            ...typeScale.md,
          }}
        >
          {BRAND.name}
        </AppText>
      ) : null}
    </View>
  );
}
