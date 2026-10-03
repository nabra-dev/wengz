import { Stack } from "expo-router";
import { AppNavHeader } from "../../../src/components/AppHeader";
import { brandStackOptions } from "../../../src/theme/navigation";
import { t } from "../../../src/i18n";
import { BRAND } from "../../../src/theme/brand";

export default function RequestsLayout() {
  return (
    <Stack
      screenOptions={{
        ...brandStackOptions,
        header: (props) => <AppNavHeader {...props} />,
        contentStyle: { backgroundColor: BRAND.colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("client.requests.title"),
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: t("client.requests.title"),
        }}
      />
      <Stack.Screen
        name="create"
        options={{
          title: t("client.newRequest.title"),
        }}
      />
    </Stack>
  );
}
