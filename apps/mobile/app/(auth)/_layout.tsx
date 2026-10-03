import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/providers/auth";
import { useLocale } from "../../src/providers/locale";
import { Loading } from "../../src/components/ui";
import { BRAND } from "../../src/theme/brand";
import { stackPushAnimation } from "../../src/theme/navigation";

export default function AuthLayout() {
  const { ready, token } = useAuth();
  const { locale } = useLocale();
  if (!ready) return <Loading />;
  if (token) return <Redirect href="/(app)" />;
  return (
    <Stack
      key={locale}
      screenOptions={{
        headerShown: false,
        animation: stackPushAnimation(),
        animationDuration: 280,
        gestureEnabled: true,
        contentStyle: { backgroundColor: BRAND.colors.background },
      }}
    />
  );
}
