"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc/client";
import { ExternalLink, ShieldAlert, ShieldOff } from "lucide-react";

type LeakFilter = "all" | "blocked" | "rate_limited";

type LeakEvent = {
  id: string;
  action: string;
  message: string;
  level: string;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | Date;
  actor: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
};

type StrikeState = {
  count: number;
  remaining: number;
  resetAt: number;
  blocked: boolean;
};

function metadataKinds(metadata: LeakEvent["metadata"]): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const kinds = metadata.kinds;
  if (!Array.isArray(kinds)) return [];
  return kinds.filter((k): k is string => typeof k === "string");
}

function metadataField(metadata: LeakEvent["metadata"]): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const field = metadata.field;
  return typeof field === "string" && field.trim() ? field : null;
}

export default function AdminContactLeaksPage() {
  const t = useTranslations("admin.contactLeaks");
  const locale = useLocale();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<LeakFilter>("all");
  const [cursor, setCursor] = useState<string | undefined>();
  const [clearingUserId, setClearingUserId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = trpc.admin.getContactLeakEvents.useQuery({
    filter,
    limit: 50,
    cursor,
  });

  const clearStrikes = trpc.admin.clearContactLeakStrikes.useMutation({
    onSuccess: (result) => {
      toast.success(result.cleared ? t("toast.cleared") : t("toast.alreadyClear"));
      void utils.admin.getContactLeakEvents.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t("toast.clearError"));
    },
    onSettled: () => setClearingUserId(null),
  });

  const events = (data?.events ?? []) as LeakEvent[];
  const stats = data?.stats;
  const strikeStates = (data?.strikeStates ?? {}) as Record<string, StrikeState>;

  const kindLabel = useMemo(
    () =>
      ({
        messaging_url: t("kinds.messaging_url"),
        social_url: t("kinds.social_url"),
        email: t("kinds.email"),
        phone: t("kinds.phone"),
        handle: t("kinds.handle"),
        solicitation: t("kinds.solicitation"),
      }) as Record<string, string>,
    [t]
  );

  const handleClearStrikes = (userId: string) => {
    setClearingUserId(userId);
    clearStrikes.mutate({ userId, reason: "Admin cleared false-positive lockout" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-8 w-8 text-orange-600" aria-hidden />
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("stats.blocked24h")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {isLoading ? "—" : (stats?.blockedLast24h ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("stats.rateLimited24h")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {isLoading ? "—" : (stats?.rateLimitedLast24h ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("stats.uniqueActors7d")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {isLoading ? "—" : (stats?.uniqueActorsLast7d ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("stats.total7d")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {isLoading ? "—" : (stats?.totalLast7d ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("tableTitle")}</CardTitle>
            <CardDescription>{t("tableDescription")}</CardDescription>
          </div>
          <Tabs
            value={filter}
            onValueChange={(value) => {
              setCursor(undefined);
              setFilter(value as LeakFilter);
            }}
          >
            <TabsList>
              <TabsTrigger value="all">{t("filters.all")}</TabsTrigger>
              <TabsTrigger value="blocked">{t("filters.blocked")}</TabsTrigger>
              <TabsTrigger value="rate_limited">{t("filters.rateLimited")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : null}

          {!isLoading && events.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              {t("empty")}
            </div>
          ) : null}

          {!isLoading && events.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.time")}</TableHead>
                    <TableHead>{t("columns.type")}</TableHead>
                    <TableHead>{t("columns.kinds")}</TableHead>
                    <TableHead>{t("columns.actor")}</TableHead>
                    <TableHead>{t("columns.field")}</TableHead>
                    <TableHead>{t("columns.request")}</TableHead>
                    <TableHead className="text-end">{t("columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((row) => {
                    const kinds = metadataKinds(row.metadata);
                    const field = metadataField(row.metadata);
                    const isRateLimited = row.action === "security.contact_leak_rate_limited";
                    const actorId = row.actor?.id ?? row.actorId;
                    const strike = actorId ? strikeStates[actorId] : undefined;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(row.createdAt).toLocaleString(locale)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={isRateLimited ? "destructive" : "secondary"}>
                              {isRateLimited ? t("type.rateLimited") : t("type.blocked")}
                            </Badge>
                            {strike?.blocked ? (
                              <Badge variant="destructive" className="w-fit">
                                {t("type.lockedNow")}
                              </Badge>
                            ) : strike ? (
                              <Badge variant="outline" className="w-fit text-xs font-normal">
                                {t("type.strikes", { count: strike.count })}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {kinds.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              kinds.map((kind) => (
                                <Badge key={kind} variant="outline" className="text-xs font-normal">
                                  {kindLabel[kind] || kind}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.actor ? (
                            <>
                              <div className="font-medium">{row.actor.name || row.actor.email}</div>
                              <div className="text-xs text-muted-foreground">{row.actor.email}</div>
                              <div className="text-xs text-muted-foreground">{row.actor.role}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {field || "—"}
                        </TableCell>
                        <TableCell>
                          {row.entityId ? (
                            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2">
                              <Link href={`/admin/requests/${row.entityId}`}>
                                <span className="font-mono text-xs">
                                  {row.entityId.slice(0, 8)}
                                </span>
                                <ExternalLink className="h-3 w-3" aria-hidden />
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-end">
                          {actorId ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={clearingUserId === actorId && clearStrikes.isPending}
                              onClick={() => handleClearStrikes(actorId)}
                              title={t("clearStrikesHint")}
                            >
                              <ShieldOff className="h-3.5 w-3.5" aria-hidden />
                              {t("clearStrikes")}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="mt-4 flex justify-end gap-2">
                {cursor ? (
                  <Button variant="outline" size="sm" onClick={() => setCursor(undefined)}>
                    {t("newest")}
                  </Button>
                ) : null}
                {data?.nextCursor ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isFetching}
                    onClick={() => setCursor(data.nextCursor ?? undefined)}
                  >
                    {t("loadMore")}
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
