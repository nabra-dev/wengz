import { useEffect, useState } from "react";
import { Redirect, Stack, useSegments } from "expo-router";
import { useAuth } from "../../src/providers/auth";
import { useLocale } from "../../src/providers/locale";
import { Loading } from "../../src/components/ui";
import { BRAND } from "../../src/theme/brand";
import { stackPushAnimation } from "../../src/theme/navigation";
import { hasCompletedOnboarding } from "../../src/lib/onboarding";

export const unstable_settings = { anchor: "welcome" };

export default function AuthLayout() {
  const { ready, token } = useAuth();
  const { locale } = useLocale();
  const segments = useSegments();
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hasCompletedOnboarding().then((done) => {
      if (!cancelled) setSeenOnboarding(done);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!ready || seenOnboarding === null) return <Loading />;
  if (token) return <Redirect href="/(app)" />;

  const onOnboarding = segments.some((s) => s === "onboarding");
  if (!seenOnboarding && !onOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }
  if (seenOnboarding && onOnboarding) {
    return <Redirect href="/(auth)/welcome" />;
  }

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
