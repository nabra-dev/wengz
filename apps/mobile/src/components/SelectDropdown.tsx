import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, typeScale } from "../theme/brand";
import { colors } from "./ui";

export type SelectOption = {
  value: string;
  label: string;
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

  const openMenu = () => {
    if (disabled) return;
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const menuWidth = compact ? 160 : Math.max(anchor?.width ?? 0, 160);

  return (
    <View
      style={{
        marginBottom: compact ? 0 : 12,
        minWidth: compact ? 96 : undefined,
      }}
    >
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          disabled={disabled}
          onPress={() => (open ? setOpen(false) : openMenu())}
          style={{
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Text
            style={{
              color: selected ? colors.foreground : colors.mutedForeground,
              fontFamily: fonts.regular,
              ...typeScale.md,
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {selected?.label ?? placeholder}
          </Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          {anchor ? (
            <View
              style={[
                styles.menu,
                {
                  top: anchor.y + anchor.height + 6,
                  left: anchor.x,
                  width: menuWidth,
                },
              ]}
            >
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: active ? "rgba(224,248,64,0.1)" : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.yellow : colors.foreground,
                        fontFamily: active ? fonts.medium : fonts.regular,
                        ...typeScale.md,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  menu: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    overflow: "hidden",
    maxHeight: 220,
    zIndex: 1000,
    elevation: 16,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});
