import { Stack } from "expo-router";
import { BRAND, fonts } from "../../../src/theme/brand";
import { t } from "../../../src/i18n";

const c = BRAND.colors;

export default function RequestsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.yellow,
        headerTitleStyle: { fontFamily: fonts.semiBold, color: c.foreground, fontSize: 16 },
        contentStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: t("client.requests.title") }} />
      <Stack.Screen name="[id]" options={{ title: t("client.requests.title") }} />
      <Stack.Screen
        name="create"
        options={{
          title: t("client.newRequest.title"),
          headerBackTitle: t("client.requests.title"),
        }}
      />
    </Stack>
  );
}
