import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from "react-native-svg";
import { BRAND } from "../theme/brand";
import { t } from "../i18n";

type Tone = "purple" | "yellow" | "ink" | "muted";

type Palette = {
  fill: string;
  deep: string;
  mid: string;
  light: string;
  shine: string;
  shadow: string;
};

const TONE: Record<Tone, Palette> = {
  purple: {
    fill: BRAND.colors.purple,
    deep: "#3D0880",
    mid: "#5B10B8",
    light: "#A56BFF",
    shine: "rgba(255,255,255,0.5)",
    shadow: "rgba(30,0,70,0.28)",
  },
  yellow: {
    fill: BRAND.colors.yellow,
    deep: "#9BB50A",
    mid: "#C9E028",
    light: "#F8FF9A",
    shine: "rgba(255,255,255,0.6)",
    shadow: "rgba(80,70,0,0.25)",
  },
  ink: {
    fill: "#3A3544",
    deep: "#1E1A28",
    mid: "#4E475C",
    light: "#7A7388",
    shine: "rgba(255,255,255,0.25)",
    shadow: "rgba(0,0,0,0.2)",
  },
  muted: {
    fill: BRAND.colors.mutedForeground,
    deep: "#6A6178",
    mid: "#8E859C",
    light: "#D0C8DA",
    shine: "rgba(255,255,255,0.3)",
    shadow: "rgba(0,0,0,0.2)",
  },
};

/**
 * Brand creators mark — solid team / matching silhouettes.
 * One lead creator in front, two peers behind (smart match).
 */
export function CreatorsIcon({
  size = 24,
  tone = "purple",
  style,
}: {
  size?: number;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const c = TONE[tone];
  const gid = `creators-${tone}-${Math.round(size)}`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("auth.onboarding.creators.titleAccent", {
        defaultValue: "Creators",
      })}
      style={[{ width: size, height: size }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id={`${gid}-body`} x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={c.light} />
            <Stop offset="0.45" stopColor={c.fill} />
            <Stop offset="1" stopColor={c.deep} />
          </LinearGradient>
          <LinearGradient id={`${gid}-side`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.mid} />
            <Stop offset="1" stopColor={c.deep} />
          </LinearGradient>
        </Defs>

        {/* Ground shadow */}
        <Ellipse cx="16" cy="28.4" rx="10.5" ry="1.6" fill={c.shadow} />

        {/* Left peer (behind) */}
        <Circle cx="7.6" cy="9.4" r="3.5" fill={`url(#${gid}-side)`} />
        <Path
          d="M2.8 21.6c0-3.4 2.4-5.8 4.8-5.8s4.8 2.4 4.8 5.8v0.4H2.8v-0.4z"
          fill={`url(#${gid}-side)`}
        />
        <Circle cx="6.4" cy="8.4" r="1.1" fill={c.shine} opacity={0.35} />

        {/* Right peer (behind) */}
        <Circle cx="24.4" cy="9.4" r="3.5" fill={`url(#${gid}-side)`} />
        <Path
          d="M19.6 21.6c0-3.4 2.4-5.8 4.8-5.8s4.8 2.4 4.8 5.8v0.4h-9.6v-0.4z"
          fill={`url(#${gid}-side)`}
        />
        <Circle cx="23.2" cy="8.4" r="1.1" fill={c.shine} opacity={0.35} />

        {/* Lead creator (front, larger) */}
        <Circle cx="16" cy="8.2" r="5.1" fill={c.deep} />
        <Circle cx="16" cy="8.2" r="4.55" fill={`url(#${gid}-body)`} />
        <Path d="M7.4 24.8c0-4.6 3.4-7.6 8.6-7.6s8.6 3 8.6 7.6v0.6H7.4v-0.6z" fill={c.deep} />
        <Path d="M8 24.2c0-4.2 3.2-7 8-7s8 2.8 8 7v0.6H8v-0.6z" fill={`url(#${gid}-body)`} />

        {/* Face / shoulder shine */}
        <Circle cx="14.4" cy="6.8" r="1.35" fill={c.shine} opacity={0.45} />
        <Path
          d="M10.2 19.4c1.6-1.4 3.6-2 5.8-2"
          fill="none"
          stroke={c.shine}
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity={0.4}
        />

        {/* Match spark — signals smart matching */}
        <Path
          d="M26.8 4.2l0.55 1.45 1.5.15-1.15 1.05.35 1.5-1.25-.8-1.25.8.35-1.5-1.15-1.05 1.5-.15z"
          fill={BRAND.colors.yellow}
        />
      </Svg>
    </View>
  );
}
