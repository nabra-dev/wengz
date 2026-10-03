import {
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  type TextProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { i18n } from "../i18n";
import { fonts } from "../theme/brand";
import { isRtl, manualMirror, startTextAlign } from "../rtl";

export function isRtlLocale(): boolean {
  return isRtl() || i18n.locale === "ar";
}

/** @deprecated Mirroring is owned by `src/rtl`; never set the `direction` style. */
export function localeDirection(): "rtl" | "ltr" {
  return isRtlLocale() ? "rtl" : "ltr";
}

/** @deprecated Use `startTextAlign()` from `src/rtl`. */
export function rtlTextAlign(): "left" | "right" {
  return manualMirror() ? "right" : "left";
}

export function rtlContainerStyle(extra?: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  return extra;
}

type WebTextExtras = { dir?: "auto"; lang?: string };

type AppTextProps = TextProps & {
  /** Default `start` follows the reading direction. */
  align?: "start" | "center" | "left" | "right";
  /** @deprecated No longer needed — text never wraps itself in a View. */
  compact?: boolean;
};

/**
 * App-wide Text.
 *
 * Under native RTL we leave `textAlign` unset so iOS uses natural alignment
 * (right for Arabic). Only manual-mirror mode sets a physical value. No
 * wrapper views, so flex rows keep working.
 */
export function AppText({ style, align = "start", compact: _compact, ...rest }: AppTextProps) {
  const webProps: WebTextExtras = { dir: "auto", lang: isRtlLocale() ? "ar" : "en" };

  const textAlign = align === "center" ? "center" : align === "start" ? startTextAlign() : align;

  return (
    <RNText
      {...rest}
      {...webProps}
      style={[{ fontFamily: fonts.regular }, style, textAlign ? { textAlign } : null]}
    />
  );
}

/** App-wide TextInput with the same alignment rules. */
export function AppTextInput({ style, ...rest }: TextInputProps) {
  const webProps: WebTextExtras = { dir: "auto", lang: isRtlLocale() ? "ar" : "en" };
  const textAlign = startTextAlign();

  return (
    <RNTextInput
      {...rest}
      {...webProps}
      style={[{ fontFamily: fonts.regular }, style, textAlign ? { textAlign } : null]}
    />
  );
}
