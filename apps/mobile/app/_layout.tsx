import { Stack, LocaleProvider as RouterLocaleProvider } from "expo-router";
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
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from "@expo-google-fonts/cairo";
import { AuthProvider } from "../src/providers/auth";
import { AppLocaleProvider, useLocale } from "../src/providers/locale";
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

  if (!fontsLoaded) return <Loading />;

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: BRAND.colors.background }}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: BRAND.colors.background }}>
        <QueryClientProvider client={queryClient}>
          <AppLocaleProvider>
            <RootNavigator />
          </AppLocaleProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
