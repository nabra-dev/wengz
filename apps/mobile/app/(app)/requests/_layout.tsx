import { Stack } from "expo-router";
import { AppHeaderTitle } from "../../../src/components/AppHeader";
import { brandStackOptions } from "../../../src/theme/navigation";
import { t } from "../../../src/i18n";

export default function RequestsLayout() {
  return (
    <Stack
      screenOptions={{
        ...brandStackOptions,
        headerTitle: () => <AppHeaderTitle />,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("client.requests.title"),
          headerBackTitle: t("tabs.requests"),
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: t("client.requests.title"),
          headerBackTitle: t("tabs.requests"),
        }}
      />
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
