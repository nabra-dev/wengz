import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/providers/auth";
import { t } from "../../src/i18n";
import { Loading } from "../../src/components/ui";
import { BRAND, fonts } from "../../src/theme/brand";
import { BrandLogo } from "../../src/components/BrandLogo";

const c = BRAND.colors;

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
          <View style={{ paddingVertical: 6 }}>
            <BrandLogo height={22} tone="yellow" />
          </View>
        ),
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: c.yellow,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 10,
          marginTop: 2,
        },
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
        options={{ href: null, title: t("client.subscription.title") }}
      />
      <Tabs.Screen name="payment" options={{ href: null, title: t("client.payment.title") }} />
    </Tabs>
  );
}
