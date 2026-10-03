import { Redirect, Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useAuth } from "../../src/providers/auth";
import { t } from "../../src/i18n";
import { Loading } from "../../src/components/ui";
import { BRAND, fonts } from "../../src/theme/brand";
import { BrandLogo } from "../../src/components/BrandLogo";

const c = BRAND.colors;

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        color: focused ? c.yellow : c.mutedForeground,
        fontSize: 10,
        fontFamily: fonts.medium,
        letterSpacing: 0.3,
      }}
    >
      {label}
    </Text>
  );
}

export default function AppLayout() {
  const { ready, token } = useAuth();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: c.background,
          borderBottomColor: c.border,
          borderBottomWidth: 1,
        },
        headerTintColor: c.foreground,
        headerTitleStyle: { fontFamily: fonts.semiBold, fontSize: 16 },
        headerTitle: () => (
          <View style={{ paddingVertical: 4 }}>
            <BrandLogo height={22} tone="yellow" />
          </View>
        ),
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: c.yellow,
        tabBarInactiveTintColor: c.mutedForeground,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarLabel: ({ focused }) => <TabLabel label={t("tabs.home")} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: t("tabs.requests"),
          headerShown: false,
          tabBarLabel: ({ focused }) => <TabLabel label={t("tabs.requests")} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("tabs.notifications"),
          tabBarLabel: ({ focused }) => (
            <TabLabel label={t("tabs.notifications")} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarLabel: ({ focused }) => <TabLabel label={t("tabs.profile")} focused={focused} />,
        }}
      />
      <Tabs.Screen name="subscribe" options={{ href: null, title: t("subscribe.title") }} />
      <Tabs.Screen name="payment" options={{ href: null, title: t("subscribe.paymentTitle") }} />
    </Tabs>
  );
}
