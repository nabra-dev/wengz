import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../src/providers/auth";
import { t } from "../../src/i18n";
import { Loading } from "../../src/components/ui";
import { AppNavHeader } from "../../src/components/AppHeader";
import { TabBarItem } from "../../src/components/TabBarItem";
import { brandTabBarOptions } from "../../src/theme/navigation";

export default function AppLayout() {
  const { ready, token } = useAuth();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        ...brandTabBarOptions,
        header: (props) => <AppNavHeader {...props} />,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarItem
              label={t("tabs.home")}
              color={color}
              focused={focused}
              activeIcon="home"
              inactiveIcon="home-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: t("tabs.requests"),
          // Stack owns the header so we don't get a white status-bar strip from nesting.
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarItem
              label={t("tabs.requests")}
              color={color}
              focused={focused}
              activeIcon="list"
              inactiveIcon="list-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("tabs.notifications"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarItem
              label={t("tabs.notifications")}
              color={color}
              focused={focused}
              activeIcon="notifications"
              inactiveIcon="notifications-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarItem
              label={t("tabs.profile")}
              color={color}
              focused={focused}
              activeIcon="person"
              inactiveIcon="person-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="subscribe"
        options={{
          href: null,
          title: t("client.subscription.title"),
          animation: "fade",
        }}
      />
      <Tabs.Screen
        name="payment"
        options={{
          href: null,
          title: t("client.payment.title"),
          animation: "fade",
        }}
      />
    </Tabs>
  );
}
