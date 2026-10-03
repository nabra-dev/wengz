import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { RefreshControl, View } from "react-native";
import { getActiveSubscription, getRequests, getUsageStats } from "../../src/lib/api";
import { useAuth } from "../../src/providers/auth";
import { t, i18n } from "../../src/i18n";
import {
  Button,
  Card,
  Loading,
  Muted,
  PageHeader,
  ScrollScreen,
  SectionTitle,
  StatCard,
  StatusBadge,
  colors,
  AppText,
} from "../../src/components/ui";
import { fonts, typeScale } from "../../src/theme/brand";

export default function HomeScreen() {
  const { user } = useAuth();
  const sub = useQuery({ queryKey: ["subscription"], queryFn: getActiveSubscription });
  const usage = useQuery({ queryKey: ["usage"], queryFn: getUsageStats });
  const requests = useQuery({ queryKey: ["requests"], queryFn: () => getRequests(5) });

  if (sub.isLoading) return <Loading />;

  const pkg = sub.data as {
    package?: { name?: string; nameI18n?: Record<string, string> };
    remainingCredits?: number;
    daysRemaining?: number;
  } | null;
  const planName =
    pkg?.package?.nameI18n?.[i18n.locale] ||
    pkg?.package?.nameI18n?.en ||
    pkg?.package?.name ||
    t("client.dashboard.stats.noActivePlan");
  const credits = pkg?.remainingCredits ?? 0;
  const firstName = user?.name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "there";

  return (
    <ScrollScreen
      keyboard={false}
      refreshControl={
        <RefreshControl
          refreshing={sub.isFetching || requests.isFetching || usage.isFetching}
          onRefresh={() => {
            void sub.refetch();
            void requests.refetch();
            void usage.refetch();
          }}
          tintColor={colors.yellow}
        />
      }
    >
      <PageHeader title={t("client.dashboard.welcome", { name: firstName })} />
      <View style={{ marginBottom: 16 }}>
        <Button
          label={t("client.dashboard.newRequest")}
          onPress={() => router.push("/(app)/requests/create")}
          variant="secondary"
        />
      </View>

      {!sub.data ? (
        <Card highlight style={{ marginBottom: 14 }}>
          <AppText
            style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}
          >
            {t("client.dashboard.noSubscription.title")}
          </AppText>
          <Muted>{t("client.dashboard.noSubscription.description")}</Muted>
          <Button
            label={t("client.dashboard.noSubscription.viewPlans")}
            onPress={() => router.push("/(app)/subscribe")}
            variant="secondary"
          />
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <StatCard
          label={t("client.dashboard.stats.creditsAvailable")}
          value={credits}
          hint={planName}
          highlight={!sub.data}
        />
        <StatCard
          label={t("client.dashboard.stats.activeRequests")}
          value={usage.data?.activeRequests ?? 0}
          hint={t("client.dashboard.stats.inProgressOrPending")}
        />
        <StatCard
          label={t("client.dashboard.stats.completed")}
          value={usage.data?.completedRequests ?? 0}
          hint={t("client.dashboard.stats.allTime")}
        />
        {typeof pkg?.daysRemaining === "number" ? (
          <StatCard
            label={t("client.dashboard.stats.daysRemaining")}
            value={pkg.daysRemaining}
            hint={t("client.dashboard.stats.subscription")}
          />
        ) : null}
      </View>

      <SectionTitle>{t("client.dashboard.recentRequests.title")}</SectionTitle>

      {(requests.data?.requests ?? []).length === 0 ? (
        <Card>
          <Muted>{t("client.dashboard.recentRequests.noRequests")}</Muted>
          <Button
            label={t("client.requests.createRequest")}
            onPress={() => router.push("/(app)/requests/create")}
          />
        </Card>
      ) : (
        <>
          {(requests.data?.requests ?? []).map((r) => (
            <Card key={String(r.id)} onPress={() => router.push(`/(app)/requests/${r.id}`)}>
              <AppText
                style={{
                  color: colors.foreground,
                  fontFamily: fonts.medium,
                  ...typeScale.md,
                  marginBottom: 8,
                }}
              >
                {String(r.title)}
              </AppText>
              <StatusBadge status={String(r.status)} />
            </Card>
          ))}
          <Button
            label={t("client.dashboard.recentRequests.viewAll")}
            onPress={() => router.push("/(app)/requests")}
            variant="ghost"
          />
        </>
      )}
    </ScrollScreen>
  );
}
