import { Image, type ImageStyle, type StyleProp } from "react-native";
import { BRAND } from "../theme/brand";

const WORDMARK_YELLOW = require("../../assets/logo-wordmark-yellow.png");
const WORDMARK_PURPLE = require("../../assets/logo-wordmark-purple.png");
const WORDMARK_WHITE = require("../../assets/logo.png");

/** Intrinsic size of the wordmark assets (wide). */
const INTRINSIC = { w: 740, h: 230 };

export function BrandLogo({
  height = 36,
  tone = "yellow",
  style,
}: {
  height?: number;
  tone?: "yellow" | "purple" | "white";
  style?: StyleProp<ImageStyle>;
}) {
  const width = (height * INTRINSIC.w) / INTRINSIC.h;
  const source =
    tone === "white" ? WORDMARK_WHITE : tone === "purple" ? WORDMARK_PURPLE : WORDMARK_YELLOW;

  return (
    <Image
      source={source}
      accessibilityLabel={BRAND.name}
      resizeMode="contain"
      style={[{ width, height }, style]}
    />
  );
}
