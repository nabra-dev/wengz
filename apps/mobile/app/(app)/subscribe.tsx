import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, View } from "react-native";
import {
  cancelSubscription,
  getActiveSubscription,
  getPackages,
  subscribe,
} from "../../src/lib/api";
import { t, i18n } from "../../src/i18n";
import {
  Button,
  Card,
  ErrorText,
  Loading,
  Muted,
  PageHeader,
  Screen,
  colors,
  listContentDefaults,
  listFillStyle,
  AppText,
} from "../../src/components/ui";
import { fonts, typeScale } from "../../src/theme/brand";

export default function SubscribeScreen() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const packages = useQuery({ queryKey: ["packages"], queryFn: getPackages });
  const active = useQuery({ queryKey: ["subscription"], queryFn: getActiveSubscription });

  const sub = useMutation({
    mutationFn: (packageId: string) => subscribe(packageId),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["subscription"] });
      await qc.invalidateQueries({ queryKey: ["subscription-pending"] });
      if (res.requiresPayment) {
        router.push("/(app)/payment");
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const cancel = useMutation({
    mutationFn: (subscriptionId: string) => cancelSubscription(subscriptionId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (packages.isLoading || active.isLoading) return <Loading />;

  const current = active.data as {
    id?: string;
    remainingCredits?: number;
    daysRemaining?: number;
    endDate?: string;
    package?: { id?: string; name?: string; nameI18n?: Record<string, string>; credits?: number };
  } | null;

  const currentName =
    current?.package?.nameI18n?.[i18n.locale] ||
    current?.package?.nameI18n?.en ||
    current?.package?.name;

  return (
    <Screen>
      <FlatList
        style={listFillStyle}
        contentContainerStyle={listContentDefaults}
        data={packages.data ?? []}
        keyExtractor={(p) => String(p.id)}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical
        ListHeaderComponent={
          <View>
            <PageHeader title={t("client.subscription.title")} />
            {error ? <ErrorText>{error}</ErrorText> : null}

            {current ? (
              <Card highlight>
                <AppText
                  style={{ color: colors.yellow, fontFamily: fonts.semiBold, marginBottom: 6 }}
                >
                  {t("client.subscription.currentSubscription.title", {
                    name: currentName || "—",
                  })}
                </AppText>
                <Muted>{t("client.subscription.currentSubscription.description")}</Muted>
                <Muted>
                  {t("client.subscription.currentSubscription.creditsRemaining")}:{" "}
                  {current.remainingCredits}
                </Muted>
                <Muted>
                  {t("client.subscription.currentSubscription.daysRemaining")}:{" "}
                  {current.daysRemaining}
                </Muted>
                <Button
                  label={t("client.subscription.currentSubscription.cancelSubscription")}
                  onPress={() => current.id && cancel.mutate(current.id)}
                  variant="danger"
                  disabled={cancel.isPending}
                />
              </Card>
            ) : (
              <Card>
                <AppText
                  style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}
                >
                  {t("client.subscription.noSubscription.title")}
                </AppText>
                <Muted>{t("client.subscription.noSubscription.description")}</Muted>
              </Card>
            )}

            <Muted style={{ marginTop: 8, marginBottom: 8 }}>
              {current
                ? t("client.subscription.plans.upgrade")
                : t("client.subscription.plans.choose")}
            </Muted>
          </View>
        }
        renderItem={({ item }) => {
          const name =
            (item.nameI18n as Record<string, string> | undefined)?.[i18n.locale] ||
            (item.nameI18n as Record<string, string> | undefined)?.en ||
            String(item.name);
          const isCurrent = current?.package?.id === item.id;
          return (
            <Card highlight={!isCurrent}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <AppText
                  style={{
                    color: colors.foreground,
                    fontFamily: fonts.semiBold,
                    ...typeScale.lg,
                    flex: 1,
                  }}
                >
                  {name}
                </AppText>
                {isCurrent ? (
                  <AppText style={{ color: colors.yellow, fontFamily: fonts.medium }}>
                    {t("client.subscription.plans.current")}
                  </AppText>
                ) : null}
              </View>
              <Muted>
                ${String(item.price)}
                {t("client.subscription.plans.perMonth")} · {String(item.credits)}{" "}
                {t("common.credits")}
              </Muted>
              <Button
                label={
                  sub.isPending
                    ? t("client.subscription.plans.processing")
                    : isCurrent
                      ? t("client.subscription.plans.currentPlan")
                      : current
                        ? t("client.subscription.plans.upgradeCta")
                        : t("client.subscription.plans.subscribe")
                }
                onPress={() => {
                  setError(null);
                  sub.mutate(String(item.id));
                }}
                disabled={sub.isPending || isCurrent}
                variant="secondary"
              />
            </Card>
          );
        }}
      />
    </Screen>
  );
}
