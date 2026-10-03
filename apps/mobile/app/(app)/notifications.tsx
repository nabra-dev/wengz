import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, RefreshControl, View } from "react-native";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../src/lib/api";
import { t } from "../../src/i18n";
import {
  Button,
  Card,
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
import { row } from "../../src/rtl";

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
  const items = q.data?.notifications ?? [];
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <Screen>
      <FlatList
        style={listFillStyle}
        contentContainerStyle={listContentDefaults}
        data={items}
        keyExtractor={(n) => String(n.id)}
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
              title={t("client.notifications.title")}
              right={
                unread > 0 ? (
                  <Button
                    label={t("client.notifications.markAllAsRead")}
                    onPress={() => markAll.mutate()}
                    variant="ghost"
                    disabled={markAll.isPending}
                    style={{ marginTop: 0 }}
                  />
                ) : undefined
              }
            />
          </View>
        }
        ListEmptyComponent={
          <Card>
            <AppText
              style={{ color: colors.foreground, fontFamily: fonts.semiBold, marginBottom: 6 }}
            >
              {t("client.notifications.noNotifications")}
            </AppText>
            <Muted>{t("client.notifications.noNotificationsDesc")}</Muted>
          </Card>
        }
        renderItem={({ item }) => (
          <Card
            highlight={!item.isRead}
            onPress={() => {
              if (!item.isRead) markOne.mutate(String(item.id));
              const link = String(item.link || "");
              const match = link.match(/\/requests\/([^/?#]+)/);
              if (match?.[1]) router.push(`/(app)/requests/${match[1]}`);
            }}
          >
            <View
              style={{
                ...row(),
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <AppText
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: colors.foreground,
                  fontFamily: item.isRead ? fonts.regular : fonts.semiBold,
                  ...typeScale.md,
                }}
              >
                {String(item.title)}
              </AppText>
              {!item.isRead ? (
                <AppText
                  style={{
                    color: colors.yellow,
                    fontFamily: fonts.medium,
                    ...typeScale.xs,
                    flexShrink: 0,
                  }}
                >
                  {t("client.notifications.new")}
                </AppText>
              ) : null}
            </View>
            <Muted style={{ marginTop: 6, marginBottom: 0 }}>{String(item.message)}</Muted>
          </Card>
        )}
      />
    </Screen>
  );
}
