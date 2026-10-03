import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { getRequests } from "../../../src/lib/api";
import { t } from "../../../src/i18n";
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
} from "../../../src/components/ui";
import { fonts } from "../../../src/theme/brand";

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
          <View>
            <PageHeader
              title={t("client.requests.title")}
              description={t("client.requests.subtitle")}
              right={
                <Button
                  label={t("client.requests.newRequest")}
                  onPress={() => router.push("/(app)/requests/create")}
                  variant="secondary"
                />
              }
            />
            <Muted>
              {t("client.requests.allRequests")} ·{" "}
              {t("client.requests.totalRequests", { count: list.length })}
            </Muted>
          </View>
        }
        ListEmptyComponent={
          <Card>
            <Text style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}>
              {t("client.requests.noRequests")}
            </Text>
            <Muted>{t("client.requests.noRequestsDesc")}</Muted>
            <Button
              label={t("client.requests.createRequest")}
              onPress={() => router.push("/(app)/requests/create")}
            />
          </Card>
        }
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/(app)/requests/${item.id}`)}>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: fonts.medium,
                fontSize: 15,
                marginBottom: 8,
              }}
            >
              {String(item.title)}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <StatusBadge status={String(item.status)} />
              {item.needsManualApproval ? (
                <Muted style={{ marginBottom: 0 }}>
                  {t("requests.card.needsManualApproval") ||
                    t("client.requestDetail.deliverableReady.title")}
                </Muted>
              ) : null}
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}
