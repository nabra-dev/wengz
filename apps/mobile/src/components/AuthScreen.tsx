import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, type ViewStyle } from "react-native";
import { AuthToolbar } from "./AuthToolbar";
import { Screen, SCROLL_BOTTOM_PAD } from "./ui";

/**
 * Auth pages with language + theme pinned under the status bar,
 * and form content free to center/scroll below.
 */
export function AuthScreen({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: ViewStyle;
}) {
  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      <AuthToolbar />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            { flexGrow: 1, justifyContent: "center", paddingBottom: SCROLL_BOTTOM_PAD },
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
