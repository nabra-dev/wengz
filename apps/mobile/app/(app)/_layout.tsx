import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/providers/auth";
import { t } from "../../src/i18n";
import { Loading } from "../../src/components/ui";
import { AppHeaderTitle } from "../../src/components/AppHeader";
import { brandTabBarOptions } from "../../src/theme/navigation";

export default function AppLayout() {
  const { ready, token } = useAuth();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        ...brandTabBarOptions,
        headerTitle: () => <AppHeaderTitle />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: t("tabs.requests"),
          // Nested stack owns the top bar (same logo chrome).
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "list" : "list-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("tabs.notifications"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "notifications" : "notifications-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscribe"
        options={{
          href: null,
          title: t("client.subscription.title"),
          headerTitle: () => <AppHeaderTitle />,
        }}
      />
      <Tabs.Screen
        name="payment"
        options={{
          href: null,
          title: t("client.payment.title"),
          headerTitle: () => <AppHeaderTitle />,
        }}
      />
    </Tabs>
  );
}
