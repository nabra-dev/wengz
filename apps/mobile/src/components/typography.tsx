import {
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  type TextProps,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { i18n } from "../i18n";
import { fonts } from "../theme/brand";

export function isRtlLocale(): boolean {
  return i18n.locale === "ar";
}

export function localeDirection(): "rtl" | "ltr" {
  return isRtlLocale() ? "rtl" : "ltr";
}

/** Apply on containers that should mirror with Arabic (inherits to children). */
export function rtlContainerStyle(extra?: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  return [{ direction: localeDirection() }, extra];
}

/** Start-aligned text — physical right in AR, left in EN. */
export function rtlTextAlign(): "left" | "right" {
  return isRtlLocale() ? "right" : "left";
}

export function rtlWritingDirection(): "rtl" | "ltr" {
  return isRtlLocale() ? "rtl" : "ltr";
}

/** Base text style every string should inherit in AR. */
export function rtlTextBase(extra?: StyleProp<TextStyle>): StyleProp<TextStyle> {
  return [
    {
      fontFamily: fonts.regular,
      textAlign: rtlTextAlign(),
      writingDirection: rtlWritingDirection(),
    },
    extra,
  ];
}

type WebTextExtras = {
  dir?: "rtl" | "ltr";
  lang?: string;
};

type AppTextProps = TextProps & {
  /** Override alignment; default is start (right in AR). Use "center" for tabs/buttons. */
  align?: "start" | "center" | "left" | "right";
};

/**
 * App-wide Text. Forces `dir` (never browser `auto`) so Arabic UI stays RTL
 * even when the string is Latin/numeric.
 */
export function AppText({ style, align = "start", ...rest }: AppTextProps) {
  const rtl = isRtlLocale();
  const textAlign =
    align === "center" ? "center" : align === "left" || align === "right" ? align : rtlTextAlign();

  const webProps: WebTextExtras = {
    dir: rtl ? "rtl" : "ltr",
    lang: i18n.locale === "ar" ? "ar" : "en",
  };

  return (
    <RNText
      {...rest}
      {...webProps}
      style={[
        {
          fontFamily: fonts.regular,
          textAlign,
          writingDirection: rtlWritingDirection(),
        },
        style,
      ]}
    />
  );
}

/** App-wide TextInput with the same RTL rules. */
export function AppTextInput({ style, ...rest }: TextInputProps) {
  const rtl = isRtlLocale();
  const webProps: WebTextExtras = {
    dir: rtl ? "rtl" : "ltr",
    lang: i18n.locale === "ar" ? "ar" : "en",
  };

  return (
    <RNTextInput
      {...rest}
      {...webProps}
      style={[
        {
          fontFamily: fonts.regular,
          textAlign: rtlTextAlign(),
          writingDirection: rtlWritingDirection(),
        },
        style,
      ]}
    />
  );
}
