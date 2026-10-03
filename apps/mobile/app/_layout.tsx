import "../src/lib/install-expo-blob";
import {
  Stack,
  LocaleProvider as RouterLocaleProvider,
  type ErrorBoundaryProps,
} from "expo-router";
import { View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Unbounded_400Regular,
  Unbounded_500Medium,
  Unbounded_600SemiBold,
  Unbounded_700Bold,
} from "@expo-google-fonts/unbounded";
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from "@expo-google-fonts/cairo";
import { AuthProvider } from "../src/providers/auth";
import { AppLocaleProvider, useLocale } from "../src/providers/locale";
import { Button, Muted, Title } from "../src/components/ui";
import { t } from "../src/i18n";
import { DebugUiProvider } from "../src/debug/DebugProvider";
import { BRAND } from "../src/theme/brand";
import { stackPushAnimation } from "../src/theme/navigation";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
});

/**
 * Root fallback for any render error below this layout. Without it a throwing
 * screen unmounts to a blank background in production.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 24,
        gap: 8,
        backgroundColor: BRAND.colors.background,
      }}
    >
      <Title>{t("common.error")}</Title>
      <Muted>{error.message}</Muted>
      <Button label={t("common.retry")} onPress={() => void retry()} variant="secondary" />
    </View>
  );
}

function RootNavigator() {
  const { locale, direction } = useLocale();

  return (
    <RouterLocaleProvider direction={direction}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          key={locale}
          screenOptions={{
            headerShown: false,
            animation: stackPushAnimation(),
            animationDuration: 280,
            contentStyle: { backgroundColor: BRAND.colors.background },
          }}
        />
      </AuthProvider>
    </RouterLocaleProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Unbounded_400Regular,
    Unbounded_500Medium,
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  // Keep the native splash up until fonts are ready (locale splash hide is below).
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: BRAND.colors.background }}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: BRAND.colors.background }}>
        <QueryClientProvider client={queryClient}>
          <AppLocaleProvider>
            <DebugUiProvider>
              <RootNavigator />
            </DebugUiProvider>
          </AppLocaleProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
