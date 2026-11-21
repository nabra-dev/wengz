import "../src/lib/install-expo-blob";
import type { ReactNode } from "react";
import {
  Stack,
  LocaleProvider as RouterLocaleProvider,
  type ErrorBoundaryProps,
} from "expo-router";
import { View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { ThemeProvider, useTheme } from "../src/providers/theme";
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

function ThemedShell({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        {children}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { locale, direction } = useLocale();
  const { colors } = useTheme();

  return (
    <RouterLocaleProvider direction={direction}>
      <AuthProvider>
        <Stack
          key={`${locale}-${colors.background}`}
          screenOptions={{
            headerShown: false,
            animation: stackPushAnimation(),
            animationDuration: 280,
            contentStyle: { backgroundColor: colors.background },
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

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AppLocaleProvider>
        <ThemeProvider>
          <ThemedShell>
            <DebugUiProvider>
              <RootNavigator />
            </DebugUiProvider>
          </ThemedShell>
        </ThemeProvider>
      </AppLocaleProvider>
    </QueryClientProvider>
  );
}
