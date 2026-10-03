import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, RefreshControl, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getRequests } from "../../../src/lib/api";
import { t, i18n } from "../../../src/i18n";
import {
  Button,
  Card,
  Loading,
  Muted,
  PageHeader,
  Screen,
  StatusBadge,
  colors,
  listContentDefaults,
  listFillStyle,
  AppText,
} from "../../../src/components/ui";
import { fonts, typeScale } from "../../../src/theme/brand";

export default function RequestsScreen() {
  const q = useQuery({ queryKey: ["requests"], queryFn: () => getRequests(50) });

  if (q.isLoading) return <Loading />;
  const list = q.data?.requests ?? [];

  return (
    <Screen>
      <FlatList
        style={listFillStyle}
        contentContainerStyle={listContentDefaults}
        data={list}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching}
            onRefresh={() => void q.refetch()}
            tintColor={colors.yellow}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 4 }}>
            <PageHeader title={t("client.requests.title")} />
            <Button
              label={t("client.requests.newRequest")}
              onPress={() => router.push("/(app)/requests/create")}
              variant="secondary"
            />
            <Muted style={{ marginTop: 14, marginBottom: 4 }}>
              {t("client.requests.allRequests")} ·{" "}
              {t("client.requests.totalRequests", { count: list.length })}
            </Muted>
          </View>
        }
        ListEmptyComponent={
          <Card>
            <AppText
              style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}
            >
              {t("client.requests.noRequests")}
            </AppText>
            <Muted>{t("client.requests.noRequestsDesc")}</Muted>
            <Button
              label={t("client.requests.createRequest")}
              onPress={() => router.push("/(app)/requests/create")}
              variant="secondary"
            />
          </Card>
        }
        renderItem={({ item }) => {
          const serviceName =
            (item.serviceType as { nameI18n?: Record<string, string>; name?: string } | undefined)
              ?.nameI18n?.[i18n.locale] ||
            (item.serviceType as { nameI18n?: Record<string, string>; name?: string } | undefined)
              ?.nameI18n?.en ||
            (item.serviceType as { name?: string } | undefined)?.name;

          return (
            <Card onPress={() => router.push(`/(app)/requests/${item.id}`)}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText
                    style={{
                      color: colors.foreground,
                      fontFamily: fonts.medium,
                      ...typeScale.md,
                      marginBottom: 8,
                    }}
                    numberOfLines={2}
                  >
                    {String(item.title)}
                  </AppText>
                  {serviceName ? <Muted style={{ marginBottom: 8 }}>{serviceName}</Muted> : null}
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <StatusBadge status={String(item.status)} />
                    {item.needsManualApproval ? (
                      <Muted style={{ marginBottom: 0 }}>
                        {t("requests.card.needsManualApproval")}
                      </Muted>
                    ) : null}
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.mutedForeground}
                  style={{ marginTop: 4 }}
                />
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}
