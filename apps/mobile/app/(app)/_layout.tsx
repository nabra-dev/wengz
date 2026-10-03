import { Redirect, Tabs, router } from "expo-router";
import { useAuth } from "../../src/providers/auth";
import { useLocale } from "../../src/providers/locale";
import { t } from "../../src/i18n";
import { Loading } from "../../src/components/ui";
import { AppNavHeader } from "../../src/components/AppHeader";
import { CenterNewRequestButton } from "../../src/components/CenterNewRequestButton";
import { TabBarItem } from "../../src/components/TabBarItem";
import { brandTabBarOptions } from "../../src/theme/navigation";

export default function AppLayout() {
  const { ready, token } = useAuth();
  const { locale, direction } = useLocale();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      key={locale}
      screenOptions={{
        ...brandTabBarOptions,
        header: (props) => <AppNavHeader {...props} />,
        tabBarShowLabel: false,
        // Native tabs ignore document `dir`; mirror items via RN direction.
        tabBarStyle: {
          ...brandTabBarOptions.tabBarStyle,
          direction,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarItem
              label={t("tabs.home")}
              color={String(color)}
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
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarItem
              label={t("tabs.requests")}
              color={String(color)}
              focused={focused}
              activeIcon="list"
              inactiveIcon="list-outline"
            />
          ),
        }}
        listeners={{
          // Create lives on the requests stack — always land on the list tab,
          // not a leftover Create screen sitting on top.
          tabPress: (e) => {
            e.preventDefault();
            router.navigate("/requests");
          },
        }}
      />
      <Tabs.Screen
        name="new-request"
        options={{
          title: t("tabs.newRequest"),
          headerShown: false,
          tabBarButton: () => <CenterNewRequestButton />,
        }}
        listeners={{
          // Never focus this placeholder tab — FAB handles navigation.
          tabPress: (e) => {
            e.preventDefault();
            router.push("/requests/create");
          },
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("tabs.notifications"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarItem
              label={t("tabs.notifications")}
              color={String(color)}
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
              color={String(color)}
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
