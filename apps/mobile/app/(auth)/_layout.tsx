import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/providers/auth";
import { useLocale } from "../../src/providers/locale";
import { Loading } from "../../src/components/ui";
import { BRAND } from "../../src/theme/brand";
import { stackPushAnimation } from "../../src/theme/navigation";

export const unstable_settings = { anchor: "welcome" };

export default function AuthLayout() {
  const { ready, token } = useAuth();
  const { locale } = useLocale();
  if (!ready) return <Loading />;
  if (token) return <Redirect href="/(app)" />;
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
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
