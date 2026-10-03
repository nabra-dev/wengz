import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BRAND, fonts, statusStyle } from "../theme/brand";
import { i18n } from "../i18n";

const c = BRAND.colors;

export function Screen({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}) {
  return (
    <SafeAreaView
      style={[styles.screen, padded && styles.padded, style]}
      edges={["top", "left", "right"]}
    >
      {children}
    </SafeAreaView>
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
        <Text style={styles.pageTitle}>{title}</Text>
        {description ? <Text style={styles.pageDesc}>{description}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
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
      <Text
        style={[
          styles.btnText,
          variant === "primary" && styles.btnTextOnPurple,
          variant === "secondary" && styles.btnTextOnYellow,
          (variant === "ghost" || variant === "danger") && { color: c.foreground },
          variant === "danger" && { color: "#fff" },
        ]}
      >
        {label}
      </Text>
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
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusStyle(status);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
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
  return <Text style={styles.error}>{children}</Text>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function useUiFontFamily() {
  return i18n.locale === "ar" ? fonts.cairo : fonts.regular;
}

export { c as colors };

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  padded: {
    paddingHorizontal: 16,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 20,
    marginTop: 8,
  },
  pageTitle: {
    color: c.foreground,
    fontSize: 22,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  pageDesc: {
    color: c.mutedForeground,
    fontSize: 13,
    marginTop: 4,
    fontFamily: fonts.regular,
    lineHeight: 18,
  },
  title: {
    color: c.foreground,
    fontSize: 24,
    fontFamily: fonts.semiBold,
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  muted: {
    color: c.mutedForeground,
    fontSize: 13,
    fontFamily: fonts.regular,
    marginBottom: 8,
    lineHeight: 18,
  },
  label: {
    color: c.foreground,
    fontSize: 12,
    fontFamily: fonts.medium,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
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
    fontSize: 15,
    fontFamily: fonts.regular,
  },
  inputMultiline: {
    minHeight: 100,
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
    fontFamily: fonts.semiBold,
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  btnTextOnPurple: {
    color: c.yellow,
  },
  btnTextOnYellow: {
    color: "#2A0A55",
  },
  card: {
    backgroundColor: c.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
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
  },
  statLabel: {
    color: c.mutedForeground,
    fontSize: 12,
    fontFamily: fonts.medium,
    marginBottom: 8,
  },
  statValue: {
    color: c.foreground,
    fontSize: 26,
    fontFamily: fonts.bold,
    fontVariant: ["tabular-nums"],
  },
  statHint: {
    color: c.mutedForeground,
    fontSize: 11,
    marginTop: 4,
    fontFamily: fonts.regular,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.medium,
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
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  sectionTitle: {
    color: c.mutedForeground,
    fontSize: 12,
    fontFamily: fonts.medium,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
});
