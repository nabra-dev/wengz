import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { AppText } from "./typography";
import { fonts } from "../theme/brand";
import { colors } from "../theme/runtime";
import { t } from "../i18n";
import { row } from "../rtl";

type Tone = "purple" | "yellow" | "muted" | "white";

type Palette = {
  fill: string;
  deep: string;
  mid: string;
  light: string;
  mark: string;
  shine: string;
  shadow: string;
};

function tonePalette(tone: Tone): Palette {
  if (tone === "purple") {
    return {
      fill: colors.purple,
      deep: "#3D0880",
      mid: "#5B10B8",
      light: "#A56BFF",
      mark: "#FFFFFF",
      shine: "rgba(255,255,255,0.55)",
      shadow: "rgba(30,0,70,0.35)",
    };
  }
  if (tone === "yellow") {
    return {
      fill: colors.yellow,
      deep: "#9BB50A",
      mid: "#C9E028",
      light: "#F8FF9A",
      mark: "#1F1606",
      shine: "rgba(255,255,255,0.65)",
      shadow: "rgba(80,70,0,0.28)",
    };
  }
  if (tone === "muted") {
    return {
      fill: colors.mutedForeground,
      deep: "#6A6178",
      mid: "#8E859C",
      light: "#D0C8DA",
      mark: colors.background,
      shine: "rgba(255,255,255,0.35)",
      shadow: "rgba(0,0,0,0.25)",
    };
  }
  return {
    fill: "#FFFFFF",
    deep: "#D8D2E6",
    mid: "#F0ECF7",
    light: "#FFFFFF",
    mark: colors.purple,
    shine: "rgba(255,255,255,0.8)",
    shadow: "rgba(105,13,212,0.2)",
  };
}

/**
 * Brand credits mark — refined wallet + credit coin.
 * Soft gradients, clasp detail, and a lifted coin for depth.
 */
export function CreditIcon({
  size = 24,
  tone = "yellow",
  style,
}: {
  size?: number;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const c = tonePalette(tone);
  const gid = `credit-${tone}-${Math.round(size)}`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("common.credits")}
      style={[{ width: size, height: size }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id={`${gid}-wallet`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.light} />
            <Stop offset="0.45" stopColor={c.fill} />
            <Stop offset="1" stopColor={c.mid} />
          </LinearGradient>
          <LinearGradient id={`${gid}-coin`} x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={c.light} />
            <Stop offset="0.55" stopColor={c.fill} />
            <Stop offset="1" stopColor={c.deep} />
          </LinearGradient>
          <LinearGradient id={`${gid}-flap`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={c.deep} stopOpacity="0.15" />
            <Stop offset="0.5" stopColor={c.deep} stopOpacity="0.55" />
            <Stop offset="1" stopColor={c.deep} stopOpacity="0.2" />
          </LinearGradient>
        </Defs>

        {/* Soft ground shadow */}
        <Path
          d="M7 27.2c0 0 3.2 1.4 9.2 1.4s9-1.4 9-1.4c0 0-2.2 1.8-9 1.8S7 27.2 7 27.2z"
          fill={c.shadow}
        />

        {/* Wallet body */}
        <Path
          d="M3.8 12.1c0-2 1.6-3.6 3.6-3.6h15.2c2 0 3.6 1.6 3.6 3.6v11.6c0 2-1.6 3.6-3.6 3.6H7.4c-2 0-3.6-1.6-3.6-3.6V12.1z"
          fill={`url(#${gid}-wallet)`}
        />

        {/* Top edge highlight */}
        <Path
          d="M7.6 8.7h14.8c1.5 0 2.8 1 3.3 2.3H4.3c.5-1.3 1.8-2.3 3.3-2.3z"
          fill={c.shine}
          opacity={0.35}
        />

        {/* Inner pocket band */}
        <Path
          d="M3.8 15.1h22.4v2.6c0 .9-.7 1.6-1.6 1.6H5.4c-.9 0-1.6-.7-1.6-1.6v-2.6z"
          fill={`url(#${gid}-flap)`}
        />

        {/* Stitch line */}
        <Path
          d="M6.2 19.8h13.6"
          fill="none"
          stroke={c.deep}
          strokeWidth="0.7"
          strokeLinecap="round"
          strokeDasharray="1.4 1.6"
          opacity={0.45}
        />

        {/* Clasp / card slot */}
        <Rect x="21.4" y="17.4" width="6.4" height="4.2" rx="1.4" fill={c.deep} />
        <Rect x="22" y="18" width="5.2" height="3" rx="1" fill={c.mid} />
        <Circle cx="24.6" cy="19.5" r="1.05" fill={c.light} />
        <Circle cx="24.6" cy="19.5" r="0.45" fill={c.deep} />

        {/* Coin shadow on wallet */}
        <Circle cx="12.4" cy="11.2" r="6.6" fill={c.shadow} opacity={0.5} />

        {/* Credit coin (lifted) */}
        <Circle cx="12" cy="9.2" r="7" fill={c.deep} />
        <Circle cx="12" cy="9.2" r="6.1" fill={`url(#${gid}-coin)`} />
        <Circle cx="12" cy="9.2" r="4.7" fill="none" stroke={c.light} strokeWidth="1.15" />
        <Circle
          cx="12"
          cy="9.2"
          r="3.55"
          fill="none"
          stroke={c.deep}
          strokeWidth="0.7"
          opacity={0.35}
        />

        {/* Rising credit bars */}
        <Rect x="9.35" y="7.55" width="1.55" height="3.5" rx="0.77" fill={c.mark} />
        <Rect x="11.25" y="6.55" width="1.55" height="4.5" rx="0.77" fill={c.mark} />
        <Rect x="13.15" y="7.15" width="1.55" height="3.9" rx="0.77" fill={c.mark} />

        {/* Coin shine arc */}
        <Path
          d="M8.3 7.2c1.5-1.8 3.8-2.6 5.8-2.1"
          fill="none"
          stroke={c.shine}
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

/** Compact credits value with the brand coin mark. */
export function CreditAmount({
  value,
  tone = "yellow",
  size = 16,
  label,
  style,
}: {
  value: string | number;
  tone?: Tone;
  size?: number;
  /** Optional trailing label (e.g. “credits”). */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const color =
    tone === "purple"
      ? colors.purple
      : tone === "muted"
        ? colors.mutedForeground
        : tone === "white"
          ? "#FFFFFF"
          : colors.accent;

  return (
    <View
      style={[
        {
          ...row(),
          alignItems: "center",
          gap: 6,
        },
        style,
      ]}
    >
      <CreditIcon size={size} tone={tone} />
      <AppText
        compact
        style={{
          color,
          fontFamily: fonts.semiBold,
          fontSize: Math.max(13, size - 1),
          lineHeight: Math.max(16, size + 2),
        }}
      >
        {value}
        {label ? ` ${label}` : ""}
      </AppText>
    </View>
  );
}
