"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type ActivityLevel = "info" | "warn" | "error" | "ALL";

type ActivityRow = {
  id: string;
  action: string;
  message: string;
  level: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string | Date;
  actor: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
};

function levelVariant(level: string) {
  if (level === "error") return "destructive" as const;
  if (level === "warn") return "secondary" as const;
  return "outline" as const;
}

export default function AdminActivityLogsPage() {
  const t = useTranslations("admin.activityLogs");
  const locale = useLocale();
  const [level, setLevel] = useState<ActivityLevel>("ALL");
  const [actionFilter, setActionFilter] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();

  const { data, isLoading, isFetching } = trpc.admin.getActivityLogs.useQuery({
    level: level === "ALL" ? undefined : level,
    action: actionFilter.trim() || undefined,
    limit: 50,
    cursor,
  });

  const logs = (data?.logs ?? []) as ActivityRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("tableTitle")}</CardTitle>
            <CardDescription>{t("tableDescription")}</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder={t("actionPlaceholder")}
              value={actionFilter}
              onChange={(e) => {
                setCursor(undefined);
                setActionFilter(e.target.value);
              }}
              className="sm:w-56"
            />
            <Tabs
              value={level}
              onValueChange={(value) => {
                setCursor(undefined);
                setLevel(value as ActivityLevel);
              }}
            >
              <TabsList>
                <TabsTrigger value="ALL">{t("filterAll")}</TabsTrigger>
                <TabsTrigger value="info">{t("filterInfo")}</TabsTrigger>
                <TabsTrigger value="warn">{t("filterWarn")}</TabsTrigger>
                <TabsTrigger value="error">{t("filterError")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : null}

          {!isLoading && logs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              {t("empty")}
            </div>
          ) : null}

          {!isLoading && logs.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.time")}</TableHead>
                    <TableHead>{t("columns.level")}</TableHead>
                    <TableHead>{t("columns.action")}</TableHead>
                    <TableHead>{t("columns.message")}</TableHead>
                    <TableHead>{t("columns.actor")}</TableHead>
                    <TableHead>{t("columns.entity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(row.createdAt).toLocaleString(locale)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={levelVariant(row.level)}>{row.level}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.action}</TableCell>
                      <TableCell className="max-w-md text-sm">{row.message}</TableCell>
                      <TableCell className="text-sm">
                        {row.actor ? (
                          <>
                            <div className="font-medium">{row.actor.name || row.actor.email}</div>
                            <div className="text-xs text-muted-foreground">{row.actor.role}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.entityType
                          ? `${row.entityType}${row.entityId ? `:${row.entityId.slice(0, 8)}` : ""}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
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
