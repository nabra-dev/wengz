import { useRef, useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, typeScale } from "../theme/brand";
import { useLocale } from "../providers/locale";
import { debugOutlineStyle } from "../debug/outline";
import { useDebugOutlineFlags } from "../debug/outline-state";
import { OverflowProbe } from "../debug/OverflowProbe";
import { alignStart, row } from "../rtl";
import { colors } from "./ui";
import { AppText } from "./typography";

export type SelectOption = {
  value: string;
  label: string;
  /** Optional leading glyph (emoji / symbol). */
  icon?: string;
  subtitle?: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Compact width for things like country codes. */
  compact?: boolean;
};

type Anchor = { x: number; y: number; width: number; height: number };

const MENU_MAX_HEIGHT = 260;

export function SelectDropdown({
  value,
  options,
  onChange,
  placeholder = "Select",
  disabled = false,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<View>(null);
  const selected = options.find((o) => o.value === value);
  const { locale } = useLocale();
  const rtl = locale === "ar";
  const { outlines } = useDebugOutlineFlags();

  const openMenu = () => {
    if (disabled) return;
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const windowH = Dimensions.get("window").height;
  const windowW = Dimensions.get("window").width;
  const menuWidth = compact
    ? Math.min(180, windowW - 24)
    : Math.min(Math.max(anchor?.width ?? 0, 200), windowW - 24);

  let menuTop = (anchor?.y ?? 0) + (anchor?.height ?? 0) + 6;
  let menuLeft = 12;
  if (anchor) {
    // measureInWindow is always physical, so pin the menu to the trigger edge
    // that matches the reading direction.
    menuLeft = rtl
      ? Math.max(12, Math.min(anchor.x + anchor.width - menuWidth, windowW - menuWidth - 12))
      : Math.max(12, Math.min(anchor.x, windowW - menuWidth - 12));
    if (menuTop + MENU_MAX_HEIGHT > windowH - 16) {
      menuTop = Math.max(16, anchor.y - MENU_MAX_HEIGHT - 6);
    }
  }

  // Match Field height (padding 12+12 + md line + borders ≈ 48).
  const FIELD_HEIGHT = 48;
  const widthStyle = {
    alignSelf: compact ? ("flex-start" as const) : ("stretch" as const),
    width: compact ? undefined : ("100%" as const),
  };

  return (
    <OverflowProbe
      name="SelectDropdown"
      style={{
        ...widthStyle,
        minWidth: compact ? 108 : undefined,
        height: compact ? FIELD_HEIGHT : undefined,
        marginBottom: compact ? 0 : 12,
        zIndex: open ? 50 : 1,
      }}
    >
      <View
        style={[
          widthStyle,
          compact ? { height: FIELD_HEIGHT } : null,
          debugOutlineStyle(outlines, "rgba(180,100,255,0.95)"),
        ]}
      >
        <View
          ref={triggerRef}
          collapsable={false}
          style={[widthStyle, compact ? { height: FIELD_HEIGHT } : null]}
        >
          <Pressable
            disabled={disabled}
            onPress={() => (open ? setOpen(false) : openMenu())}
            style={{
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: compact ? 10 : 12,
              paddingVertical: 0,
              // Source order is start → end; `row()` mirrors it when needed.
              ...row(),
              alignItems: "center",
              ...widthStyle,
              height: FIELD_HEIGHT,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {selected?.icon ? (
              <AppText style={{ ...typeScale.md, marginEnd: 8 }}>{selected.icon}</AppText>
            ) : null}
            <AppText
              style={{
                flex: 1,
                minWidth: 0,
                marginEnd: 8,
                color: selected ? colors.foreground : colors.mutedForeground,
                fontFamily: fonts.regular,
                ...typeScale.md,
              }}
              numberOfLines={compact ? 1 : 2}
            >
              {selected?.label ?? placeholder}
            </AppText>
            <Ionicons
              name={open ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>

        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.modalRoot} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
            {anchor ? (
              <View style={[styles.menu, { top: menuTop, left: menuLeft, width: menuWidth }]}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  style={{ maxHeight: MENU_MAX_HEIGHT }}
                >
                  {options.map((opt) => {
                    const active = opt.value === value;
                    const itemDisabled = Boolean(opt.disabled);
                    return (
                      <Pressable
                        key={opt.value}
                        disabled={itemDisabled}
                        onPress={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                          backgroundColor: active ? "rgba(224,248,64,0.1)" : "transparent",
                          opacity: itemDisabled ? 0.45 : 1,
                          ...row(),
                          alignItems: "center",
                        }}
                      >
                        {opt.icon ? (
                          <AppText style={{ ...typeScale.md, marginEnd: 8 }}>{opt.icon}</AppText>
                        ) : null}
                        <View style={{ flex: 1, minWidth: 0, alignItems: alignStart() }}>
                          <AppText
                            style={{
                              width: "100%",
                              color: active ? colors.yellow : colors.foreground,
                              fontFamily: active ? fonts.medium : fonts.regular,
                              ...typeScale.md,
                            }}
                          >
                            {opt.label}
                          </AppText>
                          {opt.subtitle ? (
                            <AppText
                              style={{
                                width: "100%",
                                color: colors.mutedForeground,
                                fontFamily: fonts.regular,
                                ...typeScale.sm,
                                marginTop: 2,
                              }}
                            >
                              {opt.subtitle}
                            </AppText>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </Modal>
      </View>
    </OverflowProbe>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    zIndex: 9999,
  },
  menu: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    overflow: "hidden",
    zIndex: 10000,
    elevation: 24,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
});
