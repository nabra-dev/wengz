import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Unbounded_400Regular,
  Unbounded_500Medium,
  Unbounded_600SemiBold,
  Unbounded_700Bold,
} from "@expo-google-fonts/unbounded";
import { Cairo_400Regular, Cairo_700Bold } from "@expo-google-fonts/cairo";
import { AuthProvider } from "../src/providers/auth";
import { initLocale } from "../src/i18n";
import { Loading } from "../src/components/ui";
import { BRAND } from "../src/theme/brand";
import { stackPushAnimation } from "../src/theme/navigation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
});

export default function RootLayout() {
  const [localeReady, setLocaleReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Unbounded_400Regular,
    Unbounded_500Medium,
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    Cairo_400Regular,
    Cairo_700Bold,
  });

  useEffect(() => {
    void initLocale().finally(() => setLocaleReady(true));
  }, []);

  if (!localeReady || !fontsLoaded) return <Loading />;

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: BRAND.colors.background }}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: BRAND.colors.background }}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: stackPushAnimation(),
                animationDuration: 280,
                contentStyle: { backgroundColor: BRAND.colors.background },
              }}
            />
          </AuthProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
