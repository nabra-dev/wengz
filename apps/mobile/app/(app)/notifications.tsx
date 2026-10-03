import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, RefreshControl, Text, View } from "react-native";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../src/lib/api";
import { t } from "../../src/i18n";
import { Button, Card, Loading, Muted, PageHeader, Screen, colors } from "../../src/components/ui";
import { fonts } from "../../src/theme/brand";

export default function NotificationsScreen() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(40),
    refetchInterval: 45_000,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (q.isLoading) return <Loading />;

  return (
    <Screen>
      <PageHeader
        title={t("notifications.title")}
        right={
          <Button
            label={t("notifications.markAll")}
            onPress={() => markAll.mutate()}
            variant="ghost"
            disabled={markAll.isPending}
          />
        }
      />
      <FlatList
        data={q.data?.notifications ?? []}
        keyExtractor={(n) => String(n.id)}
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
            <Muted>{t("notifications.empty")}</Muted>
          </Card>
        }
        renderItem={({ item }) => (
          <Card
            highlight={!item.isRead}
            onPress={() => {
              if (!item.isRead) markOne.mutate(String(item.id));
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontFamily: item.isRead ? fonts.regular : fonts.semiBold,
                  fontSize: 14,
                }}
              >
                {String(item.title)}
              </Text>
              {!item.isRead ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.yellow,
                    marginTop: 5,
                  }}
                />
              ) : null}
            </View>
            <Muted style={{ marginTop: 6, marginBottom: 0 }}>{String(item.message)}</Muted>
          </Card>
        )}
      />
    </Screen>
  );
}
