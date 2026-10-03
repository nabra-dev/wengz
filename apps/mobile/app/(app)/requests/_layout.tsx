import { Stack } from "expo-router";
import { AppNavHeader } from "../../../src/components/AppHeader";
import { brandModalStackOptions, brandStackOptions } from "../../../src/theme/navigation";
import { t } from "../../../src/i18n";
import { useLocale } from "../../../src/providers/locale";
import { BRAND } from "../../../src/theme/brand";

/**
 * Anchor the stack to `index`.
 *
 * Without it, deep-pushing `/requests/create` from another tab mounts this
 * stack with `create` as its ONLY route — popping it then leaves an empty
 * stack, which renders as a blank screen.
 */
export const unstable_settings = { anchor: "index" };

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
