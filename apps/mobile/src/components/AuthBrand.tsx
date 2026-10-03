import { Text, View } from "react-native";
import { BrandLogo } from "./BrandLogo";
import { BRAND, fonts } from "../theme/brand";
import { colors } from "./ui";

/** Shared auth / marketing identity block — logo + brand name. */
export function AuthBrand({
  height = 40,
  showName = false,
}: {
  height?: number;
  showName?: boolean;
}) {
  return (
    <View style={{ alignItems: "center", marginBottom: 28 }}>
      <BrandLogo height={height} tone="yellow" />
      {showName ? (
        <Text
          style={{
            marginTop: 12,
            color: colors.foreground,
            fontFamily: fonts.semiBold,
            fontSize: 14,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {BRAND.name}
        </Text>
      ) : null}
    </View>
  );
}
