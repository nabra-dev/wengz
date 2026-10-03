import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  I18nManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { i18n } from "../i18n";
import { useLocale } from "../providers/locale";
import { getRtlMode, isRtl, manualMirror } from "../rtl";
import { fonts, typeScale } from "../theme/brand";
import { loadDebugFlags, saveDebugFlags, type DebugUiFlags } from "./flags";
import { publishDebugOutlineFlags } from "./outline-state";

type DebugUiContextValue = {
  flags: DebugUiFlags;
  setFlag: <K extends keyof DebugUiFlags>(key: K, value: DebugUiFlags[K]) => void;
  toggleFlag: (key: keyof DebugUiFlags) => void;
  dumpDiagnostics: () => string;
};

const DebugUiContext = createContext<DebugUiContextValue | null>(null);

const OFF: DebugUiFlags = { outlines: false, hud: false, overflowWarn: false };

export function DebugUiProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<DebugUiFlags>(OFF);
  const [ready, setReady] = useState(!__DEV__);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!__DEV__) return;
    void loadDebugFlags().then((next) => {
      setFlags(next);
      setReady(true);
    });
  }, []);

  const persist = useCallback((next: DebugUiFlags) => {
    setFlags(next);
    publishDebugOutlineFlags({ outlines: next.outlines, overflowWarn: next.overflowWarn });
    void saveDebugFlags(next);
  }, []);

  useEffect(() => {
    publishDebugOutlineFlags({ outlines: flags.outlines, overflowWarn: flags.overflowWarn });
  }, [flags.outlines, flags.overflowWarn]);

  const setFlag = useCallback(
    <K extends keyof DebugUiFlags>(key: K, value: DebugUiFlags[K]) => {
      persist({ ...flags, [key]: value });
    },
    [flags, persist]
  );

  const toggleFlag = useCallback(
    (key: keyof DebugUiFlags) => {
      persist({ ...flags, [key]: !flags[key] });
    },
    [flags, persist]
  );

  const { width, height } = useWindowDimensions();
  const { locale, direction } = useLocale();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const dumpDiagnostics = useCallback(() => {
    const payload = {
      at: new Date().toISOString(),
      platform: Platform.OS,
      localeContext: locale,
      i18nLocale: i18n.locale,
      direction,
      rtl: {
        mode: getRtlMode(),
        isRtl: isRtl(),
        manualMirror: manualMirror(),
        nativeIsRTL: I18nManager.isRTL,
      },
      window: { width, height },
      insets,
      pathname,
      flags,
    };
    const text = JSON.stringify(payload, null, 2);
    console.log("[wengz-debug] diagnostics\n", text);
    return text;
  }, [locale, direction, width, height, insets, pathname, flags]);

  const value = useMemo(
    () => ({ flags, setFlag, toggleFlag, dumpDiagnostics }),
    [flags, setFlag, toggleFlag, dumpDiagnostics]
  );

  if (!__DEV__) {
    return <DebugUiContext.Provider value={value}>{children}</DebugUiContext.Provider>;
  }

  return (
    <DebugUiContext.Provider value={value}>
      {children}
      {ready && flags.hud ? (
        <View
          pointerEvents="box-none"
          style={[styles.hudWrap, { top: Math.max(insets.top, 8) + 4 }]}
        >
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            onLongPress={() => {
              dumpDiagnostics();
            }}
            style={styles.hudChip}
          >
            <Text style={styles.hudChipText}>
              DBG {locale}/{direction} {Math.round(width)}×{Math.round(height)} {getRtlMode()}
              {manualMirror() ? "+mirror" : ""}
            </Text>
          </Pressable>
          {expanded ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Wengz debug</Text>
              <Text style={styles.line}>route: {pathname}</Text>
              <Text style={styles.line}>
                locale: ctx={locale} i18n={i18n.locale} dir={direction}
              </Text>
              <Text style={styles.line}>
                rtl: mode={getRtlMode()} isRtl={String(isRtl())} manualMirror=
                {String(manualMirror())}
              </Text>
              <Text style={styles.line}>
                I18nManager.isRTL={String(I18nManager.isRTL)} swap=
                {String(I18nManager.doLeftAndRightSwapInRTL)}
              </Text>
              <Text style={styles.line}>
                window: {Math.round(width)}×{Math.round(height)}
              </Text>
              {(
                [
                  ["hud", "HUD"],
                  ["outlines", "Outlines"],
                  ["overflowWarn", "Overflow logs"],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => toggleFlag(key)}
                  style={[styles.toggle, flags[key] && styles.toggleOn]}
                >
                  <Text style={styles.toggleText}>
                    {flags[key] ? "ON " : "OFF"} {label}
                  </Text>
                </Pressable>
              ))}
              <Pressable onPress={() => dumpDiagnostics()} style={styles.toggle}>
                <Text style={styles.toggleText}>Dump diagnostics → Metro</Text>
              </Pressable>
              <Text style={styles.hint}>
                Long-press chip to dump. Outlines = borders on shared UI. Overflow logs → Metro.
                mode=native means iOS mirrors layout itself; mode=manual means the app mirrors rows
                by hand.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </DebugUiContext.Provider>
  );
}

export function useDebugUi(): DebugUiContextValue {
  const ctx = useContext(DebugUiContext);
  if (!ctx) {
    return {
      flags: OFF,
      setFlag: () => undefined,
      toggleFlag: () => undefined,
      dumpDiagnostics: () => "",
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  hudWrap: {
    position: "absolute",
    start: 8,
    zIndex: 99999,
    maxWidth: 300,
  },
  hudChip: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(224,248,64,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hudChipText: {
    color: "#1a1028",
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  panel: {
    marginTop: 6,
    backgroundColor: "rgba(14,10,20,0.94)",
    borderWidth: 1,
    borderColor: "rgba(224,248,64,0.45)",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  panelTitle: {
    color: "#E0F840",
    fontFamily: fonts.semiBold,
    ...typeScale.sm,
    marginBottom: 2,
  },
  line: {
    color: "#F5F7E8",
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  toggle: {
    marginTop: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  toggleOn: {
    borderColor: "rgba(224,248,64,0.55)",
    backgroundColor: "rgba(224,248,64,0.12)",
  },
  toggleText: {
    color: "#F5F7E8",
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  hint: {
    color: "rgba(245,247,232,0.55)",
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
});
