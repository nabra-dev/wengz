import { Stack } from "expo-router";
import { AppNavHeader } from "../../../src/components/AppHeader";
import { brandModalStackOptions, brandStackOptions } from "../../../src/theme/navigation";
import { t } from "../../../src/i18n";
import { useLocale } from "../../../src/providers/locale";
import { BRAND } from "../../../src/theme/brand";

export default function RequestsLayout() {
  const { locale } = useLocale();

  return (
    <Stack
      key={locale}
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
          ...brandModalStackOptions,
          title: t("client.newRequest.title"),
        }}
      />
    </Stack>
  );
}
