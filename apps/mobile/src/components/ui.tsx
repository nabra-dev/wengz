import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type RefreshControlProps,
  type ScrollViewProps,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fonts, statusStyle, typeScale } from "../theme/brand";
import { colors as runtimeColors } from "../theme/runtime";
import type { ThemeColors } from "../theme/palettes";
import { useTheme } from "../providers/theme";
import { t } from "../i18n";
import { AppText, AppTextInput } from "./typography";
import { alignStart, row, startTextAlign } from "../rtl";
import { debugOutlineStyle } from "../debug/outline";
import { useDebugOutlineFlags } from "../debug/outline-state";

export { typeScale };
export { AppText, AppTextInput } from "./typography";
/** Theme-aware palette — reads active scheme at access time. */
export const colors = runtimeColors;

/** Bottom inset so content clears the tab bar / home indicator. */
export const SCROLL_BOTTOM_PAD = 40;

export const listFillStyle: ViewStyle = {
  flex: 1,
};

export const listContentDefaults: ViewStyle = {
  flexGrow: 1,
  paddingBottom: SCROLL_BOTTOM_PAD,
};

function useThemedStyles() {
  const { colors: c } = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}

function makeStyles(c: ThemeColors) {
  return {
    screen: { flex: 1, backgroundColor: c.background } as ViewStyle,
    pageTitle: { color: c.foreground, ...typeScale.xl } as TextStyle,
    pageDesc: { color: c.mutedForeground, ...typeScale.sm, marginTop: 4 } as TextStyle,
    title: { color: c.foreground, ...typeScale.xl, marginBottom: 6 } as TextStyle,
    muted: { color: c.mutedForeground, ...typeScale.sm, marginBottom: 8 } as TextStyle,
    label: { color: c.foreground, ...typeScale.sm, marginBottom: 6 } as TextStyle,
    input: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      color: c.foreground,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
      ...typeScale.md,
    } as TextStyle,
    btnPrimary: { backgroundColor: c.purple } as ViewStyle,
    btnSecondary: { backgroundColor: c.yellow } as ViewStyle,
    btnGhost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: c.border,
    } as ViewStyle,
    btnDanger: { backgroundColor: c.destructive } as ViewStyle,
    btnTextOnPurple: { color: c.yellow } as TextStyle,
    btnTextOnYellow: { color: "#2A0A55" } as TextStyle,
    card: {
      alignSelf: "stretch",
      width: "100%",
      maxWidth: "100%",
      alignItems: "stretch",
      overflow: "hidden",
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    } as ViewStyle,
    cardHighlight: {
      borderColor: "rgba(105,13,212,0.45)",
      backgroundColor: "rgba(105,13,212,0.08)",
    } as ViewStyle,
    statLabel: { color: c.mutedForeground, ...typeScale.sm, marginBottom: 8 } as TextStyle,
    statValue: {
      color: c.foreground,
      ...typeScale.display,
      fontVariant: ["tabular-nums"],
    } as TextStyle,
    statHint: { color: c.mutedForeground, ...typeScale.xs, marginTop: 4 } as TextStyle,
    segmentItem: {
      flex: 1,
      height: 42,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    } as ViewStyle,
    segmentItemActive: {
      backgroundColor: c.purple,
      borderColor: c.purple,
    } as ViewStyle,
    segmentLabel: { color: c.foreground, ...typeScale.sm } as TextStyle,
    segmentLabelActive: { color: c.yellow } as TextStyle,
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.background,
    } as ViewStyle,
    error: { color: c.destructive, marginBottom: 10, ...typeScale.sm } as TextStyle,
    sectionTitle: {
      color: c.mutedForeground,
      ...typeScale.sm,
      marginBottom: 8,
      marginTop: 16,
    } as TextStyle,
    destructive: c.destructive,
    mutedForeground: c.mutedForeground,
    foreground: c.foreground,
    yellow: c.yellow,
  };
}

const layout = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  padded: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pageHeader: {
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
    marginTop: 0,
  },
  passwordWrap: {
    position: "relative",
    marginBottom: 12,
  },
  passwordInput: {
    marginBottom: 0,
    paddingEnd: 44,
  },
  passwordToggle: {
    position: "absolute",
    end: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 36,
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  btnText: {},
  statCard: {
    flex: 1,
    minWidth: "46%",
    marginBottom: 0,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    ...typeScale.xs,
  },
  segmentRow: {
    gap: 8,
    marginBottom: 14,
  },
});

export function Screen({
  children,
  style,
  padded = true,
  edges = ["left", "right"],
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  edges?: Edge[];
}) {
  const s = useThemedStyles();
  const { outlines } = useDebugOutlineFlags();
  return (
    <SafeAreaView
      style={[
        s.screen,
        padded && layout.padded,
        debugOutlineStyle(outlines, "rgba(0,200,255,0.7)"),
        style,
      ]}
      edges={edges}
    >
      {children}
    </SafeAreaView>
  );
}

type ScrollScreenProps = {
  children: React.ReactNode;
  padded?: boolean;
  edges?: Edge[];
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  keyboard?: boolean;
  bottomPad?: number;
} & Pick<ScrollViewProps, "stickyHeaderIndices">;

export function ScrollScreen({
  children,
  padded = true,
  edges = ["left", "right"],
  style,
  contentContainerStyle,
  refreshControl,
  keyboard = true,
  bottomPad = SCROLL_BOTTOM_PAD,
  stickyHeaderIndices,
}: ScrollScreenProps) {
  const body = (
    <ScrollView
      style={layout.scroll}
      contentContainerStyle={[{ flexGrow: 1, paddingBottom: bottomPad }, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical
      nestedScrollEnabled
      bounces
      refreshControl={refreshControl}
      stickyHeaderIndices={stickyHeaderIndices}
    >
      {children}
    </ScrollView>
  );

  return (
    <Screen padded={padded} edges={edges} style={style}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={layout.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Screen>
  );
}

export function PageHeader({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  const s = useThemedStyles();
  return (
    <View style={[layout.pageHeader, row()]}>
      <View style={{ flex: 1, minWidth: 0, alignItems: alignStart() }}>
        <AppText style={[s.pageTitle, { fontFamily: fonts.semiBold }]}>{title}</AppText>
        {description ? (
          <AppText style={[s.pageDesc, { fontFamily: fonts.regular }]}>{description}</AppText>
        ) : null}
      </View>
      {right ? <View style={{ flexShrink: 0 }}>{right}</View> : null}
    </View>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const s = useThemedStyles();
  return <AppText style={[s.title, { fontFamily: fonts.semiBold }, style]}>{children}</AppText>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const s = useThemedStyles();
  return <AppText style={[s.muted, { fontFamily: fonts.regular }, style]}>{children}</AppText>;
}

export function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  const s = useThemedStyles();
  const textAlign = startTextAlign();
  return (
    <RNText
      style={[
        s.label,
        { fontFamily: fonts.medium, width: "100%" },
        textAlign ? { textAlign } : null,
      ]}
    >
      {children}
      {required ? (
        <RNText style={{ color: s.destructive, fontFamily: fonts.medium }}> *</RNText>
      ) : null}
    </RNText>
  );
}

export function Field(props: TextInputProps) {
  const s = useThemedStyles();
  const { outlines } = useDebugOutlineFlags();
  const [visible, setVisible] = useState(false);
  const isPassword = props.secureTextEntry === true;

  if (isPassword) {
    return (
      <View style={layout.passwordWrap}>
        <AppTextInput
          placeholderTextColor={s.mutedForeground}
          {...props}
          secureTextEntry={!visible}
          style={[
            s.input,
            layout.passwordInput,
            props.multiline && layout.inputMultiline,
            outlines ? { borderWidth: 1, borderColor: "rgba(255,170,0,0.9)" } : null,
            props.style,
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? t("common.hidePassword") : t("common.showPassword")}
          hitSlop={8}
          onPress={() => setVisible((prev) => !prev)}
          style={layout.passwordToggle}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={s.mutedForeground}
          />
        </Pressable>
      </View>
    );
  }

  return (
    <AppTextInput
      placeholderTextColor={s.mutedForeground}
      {...props}
      style={[
        s.input,
        props.multiline && layout.inputMultiline,
        outlines ? { borderWidth: 1, borderColor: "rgba(255,170,0,0.9)" } : null,
        props.style,
      ]}
    />
  );
}

export function Button({
  label,
  onPress,
  disabled,
  variant = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  style?: ViewStyle;
}) {
  const s = useThemedStyles();
  const { outlines } = useDebugOutlineFlags();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        layout.btn,
        variant === "primary" && s.btnPrimary,
        variant === "secondary" && s.btnSecondary,
        variant === "ghost" && s.btnGhost,
        variant === "danger" && s.btnDanger,
        debugOutlineStyle(outlines, "rgba(224,248,64,0.9)"),
        (disabled || pressed) && { opacity: 0.75 },
        style,
      ]}
    >
      <AppText
        align="center"
        numberOfLines={1}
        style={[
          layout.btnText,
          { fontFamily: fonts.semiBold, ...typeScale.md },
          variant === "primary" && s.btnTextOnPurple,
          variant === "secondary" && s.btnTextOnYellow,
          (variant === "ghost" || variant === "danger") && { color: s.foreground },
          variant === "danger" && { color: "#fff" },
        ]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function Card({
  children,
  onPress,
  highlight,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  highlight?: boolean;
  style?: ViewStyle;
}) {
  const s = useThemedStyles();
  const { outlines } = useDebugOutlineFlags();
  const body = (
    <View
      style={[
        s.card,
        highlight && s.cardHighlight,
        debugOutlineStyle(outlines, "rgba(255,45,85,0.85)"),
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.9 }}>
        {body}
      </Pressable>
    );
  }
  return body;
}

export function StatCard({
  label,
  value,
  hint,
  highlight,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  const s = useThemedStyles();
  return (
    <Card highlight={highlight} style={layout.statCard}>
      <View style={{ ...row(), alignItems: "center", gap: 6, marginBottom: 2 }}>
        {icon}
        <AppText
          compact
          style={[s.statLabel, { fontFamily: fonts.medium, marginBottom: 0, flex: 1 }]}
        >
          {label}
        </AppText>
      </View>
      <AppText compact style={[s.statValue, { fontFamily: fonts.bold }]}>
        {value}
      </AppText>
      {hint ? (
        <AppText compact style={[s.statHint, { fontFamily: fonts.regular }]}>
          {hint}
        </AppText>
      ) : null}
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusStyle(status);
  const label = t(`common.requestStatus.${status}`, { defaultValue: status });
  return (
    <View style={[layout.badge, { backgroundColor: s.bg }]}>
      <AppText
        compact
        align="center"
        style={[layout.badgeText, { color: s.fg, fontFamily: fonts.medium }]}
      >
        {label}
      </AppText>
    </View>
  );
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
}) {
  const s = useThemedStyles();
  return (
    <View style={[layout.segmentRow, row()]}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[s.segmentItem, active && s.segmentItemActive]}
          >
            <AppText
              align="center"
              style={[s.segmentLabel, { fontFamily: fonts.medium }, active && s.segmentLabelActive]}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Loading() {
  const s = useThemedStyles();
  return (
    <View style={s.center}>
      <ActivityIndicator color={s.yellow} size="large" />
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  const s = useThemedStyles();
  return <AppText style={[s.error, { fontFamily: fonts.regular }]}>{children}</AppText>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const s = useThemedStyles();
  return (
    <View style={{ width: "100%", alignItems: alignStart(), marginBottom: 8, marginTop: 16 }}>
      <AppText
        style={[s.sectionTitle, { fontFamily: fonts.medium, marginBottom: 0, marginTop: 0 }]}
      >
        {children}
      </AppText>
    </View>
  );
}

export function useUiFontFamily() {
  return fonts.regular;
}
