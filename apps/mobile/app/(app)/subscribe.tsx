import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Text } from "react-native";
import { getPackages, subscribe } from "../../src/lib/api";
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
} from "../../src/components/ui";
import { fonts } from "../../src/theme/brand";

export default function SubscribeScreen() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const packages = useQuery({ queryKey: ["packages"], queryFn: getPackages });

  const sub = useMutation({
    mutationFn: (packageId: string) => subscribe(packageId),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["subscription"] });
      if (res.requiresPayment && res.subscription?.id) {
        router.push({
          pathname: "/(app)/payment",
          params: {
            subscriptionId: String(res.subscription.id),
            amount: String(
              (res.subscription as { package?: { price?: number } }).package?.price ?? ""
            ),
          },
        });
      } else {
        router.back();
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  if (packages.isLoading) return <Loading />;

  return (
    <Screen>
      <PageHeader title={t("subscribe.title")} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <FlatList
        data={packages.data ?? []}
        keyExtractor={(p) => String(p.id)}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const name =
            (item.nameI18n as Record<string, string> | undefined)?.[i18n.locale] ||
            (item.nameI18n as Record<string, string> | undefined)?.en ||
            String(item.name);
          return (
            <Card highlight>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: fonts.semiBold,
                  fontSize: 17,
                  marginBottom: 6,
                }}
              >
                {name}
              </Text>
              <Muted>
                ${String(item.price)} · {String(item.credits)} {t("common.credits")}
              </Muted>
              <Button
                label={t("subscribe.subscribe")}
                onPress={() => {
                  setError(null);
                  sub.mutate(String(item.id));
                }}
                disabled={sub.isPending}
                variant="secondary"
              />
            </Card>
          );
        }}
      />
    </Screen>
  );
}
