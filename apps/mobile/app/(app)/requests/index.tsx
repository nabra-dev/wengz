import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, RefreshControl, Text } from "react-native";
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
} from "../../../src/components/ui";
import { fonts } from "../../../src/theme/brand";

export default function RequestsScreen() {
  const q = useQuery({ queryKey: ["requests"], queryFn: () => getRequests(50) });

  if (q.isLoading) return <Loading />;

  return (
    <Screen>
      <PageHeader
        title={t("requests.title")}
        right={
          <Button
            label={t("requests.create")}
            onPress={() => router.push("/(app)/requests/create")}
            variant="secondary"
          />
        }
      />
      <FlatList
        data={q.data?.requests ?? []}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching}
            onRefresh={() => void q.refetch()}
            tintColor={colors.yellow}
          />
        }
        ListEmptyComponent={
          <Card>
            <Muted>{t("requests.empty")}</Muted>
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
            <StatusBadge status={String(item.status)} />
          </Card>
        )}
      />
    </Screen>
  );
}
