import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { getActiveSubscription, getRequests } from "../../src/lib/api";
import { useAuth } from "../../src/providers/auth";
import { t, i18n } from "../../src/i18n";
import {
  Button,
  Card,
  Loading,
  Muted,
  PageHeader,
  Screen,
  SectionTitle,
  StatCard,
  StatusBadge,
  colors,
} from "../../src/components/ui";
import { fonts } from "../../src/theme/brand";

export default function HomeScreen() {
  const { user } = useAuth();
  const sub = useQuery({ queryKey: ["subscription"], queryFn: getActiveSubscription });
  const requests = useQuery({ queryKey: ["requests"], queryFn: () => getRequests(5) });

  if (sub.isLoading) return <Loading />;

  const pkg = sub.data as {
    package?: { name?: string; nameI18n?: Record<string, string> };
    remainingCredits?: number;
  } | null;
  const planName =
    pkg?.package?.nameI18n?.[i18n.locale] ||
    pkg?.package?.nameI18n?.en ||
    pkg?.package?.name ||
    "—";
  const credits = pkg?.remainingCredits ?? 0;
  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={sub.isFetching || requests.isFetching}
            onRefresh={() => {
              void sub.refetch();
              void requests.refetch();
            }}
            tintColor={colors.yellow}
          />
        }
      >
        <PageHeader
          title={t("home.welcome") + (firstName ? `, ${firstName}` : "")}
          description={t("home.recentRequests")}
          right={
            <View style={{ width: 120 }}>
              <Button
                label={t("home.newRequest")}
                onPress={() => router.push("/(app)/requests/create")}
                variant="secondary"
              />
            </View>
          }
        />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
          <StatCard
            label={t("common.credits")}
            value={credits}
            hint={sub.data ? `${t("home.activePlan")}: ${planName}` : t("home.noPlan")}
            highlight={!sub.data}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Button
              label={t("home.viewPackages")}
              onPress={() => router.push("/(app)/subscribe")}
              variant="ghost"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={t("tabs.requests")}
              onPress={() => router.push("/(app)/requests")}
              variant="primary"
            />
          </View>
        </View>

        <SectionTitle>{t("home.recentRequests")}</SectionTitle>
        {(requests.data?.requests ?? []).length === 0 ? (
          <Card>
            <Muted>{t("requests.empty")}</Muted>
            <Button
              label={t("requests.create")}
              onPress={() => router.push("/(app)/requests/create")}
            />
          </Card>
        ) : (
          (requests.data?.requests ?? []).map((r) => (
            <Card key={String(r.id)} onPress={() => router.push(`/(app)/requests/${r.id}`)}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: fonts.medium,
                  fontSize: 15,
                  marginBottom: 8,
                }}
              >
                {String(r.title)}
              </Text>
              <StatusBadge status={String(r.status)} />
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
