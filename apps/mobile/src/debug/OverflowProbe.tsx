import React from "react";
import { View, useWindowDimensions, type LayoutChangeEvent, type ViewStyle } from "react-native";
import { useDebugOutlineFlags } from "./outline-state";

/**
 * Wraps a subtree and logs when its laid-out width exceeds the window
 * (common RTL / flex shrink bug).
 */
export function OverflowProbe({
  name,
  children,
  style,
}: {
  name: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const flags = useDebugOutlineFlags();
  const { width: winW } = useWindowDimensions();

  function onLayout(e: LayoutChangeEvent) {
    if (!flags.overflowWarn) return;
    const { width, x } = e.nativeEvent.layout;
    if (width > winW + 2) {
      console.warn(
        `[wengz-debug] OVERFLOW "${name}" width=${Math.round(width)} window=${Math.round(winW)} x=${Math.round(x)}`
      );
    } else if (x + width > winW + 2) {
      console.warn(
        `[wengz-debug] CLIPPED "${name}" rightEdge=${Math.round(x + width)} window=${Math.round(winW)}`
      );
    }
  }

  return (
    <View style={style} onLayout={onLayout} collapsable={false}>
      {children}
    </View>
  );
}
