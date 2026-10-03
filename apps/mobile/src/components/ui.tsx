import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type ScrollViewProps,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { BRAND, fonts, statusStyle, typeScale } from "../theme/brand";
import { t } from "../i18n";
import { AppText, AppTextInput } from "./typography";

const c = BRAND.colors;

export { typeScale };
export { AppText, AppTextInput } from "./typography";

/** Bottom inset so content clears the tab bar / home indicator. */
export const SCROLL_BOTTOM_PAD = 40;

export const listFillStyle: ViewStyle = {
  flex: 1,
};

export const listContentDefaults: ViewStyle = {
  flexGrow: 1,
  paddingBottom: SCROLL_BOTTOM_PAD,
};

export function Screen({
  children,
  style,
  padded = true,
  /** Use `top` only on auth / edge-to-edge screens without a nav header. */
  edges = ["left", "right"],
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView style={[styles.screen, padded && styles.padded, style]} edges={edges}>
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
  /** Extra space above the default bottom pad (e.g. sticky footers). */
  bottomPad?: number;
} & Pick<ScrollViewProps, "stickyHeaderIndices">;

/** Full-height scrollable page — use on every form / content screen. */
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
      style={styles.scroll}
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
          style={styles.flex}
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
  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1 }}>
        <AppText style={[styles.pageTitle, { fontFamily: fonts.semiBold }]}>{title}</AppText>
        {description ? (
          <AppText style={[styles.pageDesc, { fontFamily: fonts.regular }]}>{description}</AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return (
    <AppText style={[styles.title, { fontFamily: fonts.semiBold }, style]}>{children}</AppText>
  );
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <AppText style={[styles.muted, { fontFamily: fonts.regular }, style]}>{children}</AppText>;
}

export function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <AppText style={[styles.label, { fontFamily: fonts.medium }]}>
      {children}
      {required ? <AppText style={{ color: c.destructive }}> *</AppText> : null}
    </AppText>
  );
}

export function Field(props: TextInputProps) {
  return (
    <AppTextInput
      placeholderTextColor={c.mutedForeground}
      {...props}
      style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
    />
  );
}

export function Button({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "secondary" && styles.btnSecondary,
        variant === "ghost" && styles.btnGhost,
        variant === "danger" && styles.btnDanger,
        (disabled || pressed) && { opacity: 0.75 },
      ]}
    >
      <AppText
        style={[
          styles.btnText,
          { fontFamily: fonts.semiBold, textAlign: "center" },
          variant === "primary" && styles.btnTextOnPurple,
          variant === "secondary" && styles.btnTextOnYellow,
          (variant === "ghost" || variant === "danger") && { color: c.foreground },
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
  const body = (
    <View style={[styles.card, highlight && styles.cardHighlight, style]}>{children}</View>
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
}: {
  label: string;
  value: string | number;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Card highlight={highlight} style={styles.statCard}>
      <AppText style={[styles.statLabel, { fontFamily: fonts.medium }]}>{label}</AppText>
      <AppText style={[styles.statValue, { fontFamily: fonts.bold }]}>{value}</AppText>
      {hint ? (
        <AppText style={[styles.statHint, { fontFamily: fonts.regular }]}>{hint}</AppText>
      ) : null}
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusStyle(status);
  const label = t(`common.requestStatus.${status}`, { defaultValue: status });
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <AppText style={[styles.badgeText, { color: s.fg, fontFamily: fonts.medium }]}>
        {label}
      </AppText>
    </View>
  );
}

/** Shared two/three-way tabs used on profile + request detail. */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
          >
            <AppText
              style={[
                styles.segmentLabel,
                { fontFamily: fonts.medium, textAlign: "center" },
                active && styles.segmentLabelActive,
              ]}
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
  return (
    <View style={styles.center}>
      <ActivityIndicator color={c.yellow} size="large" />
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <AppText style={[styles.error, { fontFamily: fonts.regular }]}>{children}</AppText>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <AppText style={[styles.sectionTitle, { fontFamily: fonts.medium }]}>{children}</AppText>;
}

export function useUiFontFamily() {
  return fonts.regular;
}

export { c as colors };

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: 16,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  pageTitle: {
    color: c.foreground,
    ...typeScale.xl,
  },
  pageDesc: {
    color: c.mutedForeground,
    ...typeScale.sm,
    marginTop: 4,
  },
  title: {
    color: c.foreground,
    ...typeScale.xl,
    marginBottom: 6,
  },
  muted: {
    color: c.mutedForeground,
    ...typeScale.sm,
    marginBottom: 8,
  },
  label: {
    color: c.foreground,
    ...typeScale.sm,
    marginBottom: 6,
  },
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
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  btnPrimary: {
    backgroundColor: c.purple,
  },
  btnSecondary: {
    backgroundColor: c.yellow,
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: c.border,
  },
  btnDanger: {
    backgroundColor: c.destructive,
  },
  btnText: {
    ...typeScale.md,
  },
  btnTextOnPurple: {
    color: c.yellow,
  },
  btnTextOnYellow: {
    color: "#2A0A55",
  },
  card: {
    backgroundColor: c.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardHighlight: {
    borderColor: "rgba(105,13,212,0.45)",
    backgroundColor: "rgba(105,13,212,0.08)",
  },
  statCard: {
    flex: 1,
    minWidth: "46%",
    marginBottom: 0,
  },
  statLabel: {
    color: c.mutedForeground,
    ...typeScale.sm,
    marginBottom: 8,
  },
  statValue: {
    color: c.foreground,
    ...typeScale.display,
    fontVariant: ["tabular-nums"],
  },
  statHint: {
    color: c.mutedForeground,
    ...typeScale.xs,
    marginTop: 4,
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
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  segmentItem: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  segmentItemActive: {
    backgroundColor: c.purple,
    borderColor: c.purple,
  },
  segmentLabel: {
    color: c.foreground,
    ...typeScale.sm,
  },
  segmentLabelActive: {
    color: c.yellow,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.background,
  },
  error: {
    color: c.destructive,
    marginBottom: 10,
    ...typeScale.sm,
  },
  sectionTitle: {
    color: c.mutedForeground,
    ...typeScale.sm,
    marginBottom: 8,
    marginTop: 16,
  },
});
