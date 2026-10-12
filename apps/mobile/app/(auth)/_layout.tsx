import { Redirect, Stack, useSegments } from "expo-router";
import { useAuth } from "../../src/providers/auth";
import { useLocale } from "../../src/providers/locale";
import { Loading } from "../../src/components/ui";
import { BRAND } from "../../src/theme/brand";
import { stackPushAnimation } from "../../src/theme/navigation";
import { shouldForceOnboarding } from "../../src/lib/onboarding";

export const unstable_settings = { anchor: "welcome" };

/** Auth stack only — entry (onboarding vs welcome) is decided by `app/index.tsx`. */
export default function AuthLayout() {
  const { ready, token } = useAuth();
  const { locale } = useLocale();
  const onOnboarding = useSegments().includes("onboarding");

  if (!ready) return <Loading />;
  if (token && !onOnboarding && !shouldForceOnboarding()) return <Redirect href="/(app)" />;

  return (
    <Stack
      key={locale}
      initialRouteName="welcome"
      screenOptions={{
        headerShown: false,
        animation: stackPushAnimation(),
        animationDuration: 280,
        gestureEnabled: true,
        contentStyle: { backgroundColor: BRAND.colors.background },
      }}
    >
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
