"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { showError, showSuccess } from "@/lib/error-handler";
import { Archive, Check, Inbox, Mail, MessageSquare } from "lucide-react";

type StatusFilter = "NEW" | "READ" | "ARCHIVED" | "ALL";

export default function AdminContactsPage() {
  const t = useTranslations("admin.contacts");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const highlightId = searchParams?.get("id") ?? null;

  const [tab, setTab] = useState<StatusFilter>("NEW");
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);

  useEffect(() => {
    if (highlightId) setSelectedId(highlightId);
  }, [highlightId]);

  const statusFilter = tab === "ALL" ? undefined : tab;
  const listQuery = trpc.admin.getContactMessages.useQuery(
    { status: statusFilter, limit: 50 },
    { refetchOnWindowFocus: true }
  );
  const detailQuery = trpc.admin.getContactMessage.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );
  const utils = trpc.useUtils();

  const updateStatus = trpc.admin.updateContactMessageStatus.useMutation({
    onSuccess: async (_data, variables) => {
      if (variables.status === "ARCHIVED" || variables.status === "NEW") {
        showSuccess(t("toast.updated"));
      }
      await Promise.all([
        utils.admin.getContactMessages.invalidate(),
        selectedId
          ? utils.admin.getContactMessage.invalidate({ id: selectedId })
          : Promise.resolve(),
      ]);
    },
    onError: (err) => showError(err, t("toast.error")),
  });
  const messages = listQuery.data?.messages ?? [];
  const selected = detailQuery.data ?? null;

  useEffect(() => {
    if (selected?.status === "NEW" && selected.id === selectedId) {
      updateStatus.mutate({ id: selected.id, status: "READ" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark once when opening
  }, [selected?.id, selected?.status]);

  const statusBadge = (status: string) => {
    if (status === "NEW") return <Badge>{t("status.new")}</Badge>;
    if (status === "READ") return <Badge variant="secondary">{t("status.read")}</Badge>;
    return <Badge variant="outline">{t("status.archived")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="NEW">{t("tabs.new")}</TabsTrigger>
          <TabsTrigger value="READ">{t("tabs.read")}</TabsTrigger>
          <TabsTrigger value="ARCHIVED">{t("tabs.archived")}</TabsTrigger>
          <TabsTrigger value="ALL">{t("tabs.all")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4" />
            {t("listTitle")}
          </CardTitle>
          <CardDescription>{t("listDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {messages.map((msg) => (
                <li key={msg.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(msg.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50 ${
                      selectedId === msg.id ? "bg-muted/60" : ""
                    }`}
                  >
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{msg.fullName}</span>
                        {statusBadge(msg.status)}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{msg.email}</p>
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {msg.topic ? `${msg.topic} · ` : ""}
                        {msg.message}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDate(msg.createdAt, locale)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-lg sm:max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.fullName}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  <a
                    href={`mailto:${selected.email}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {selected.email}
                  </a>
                  <span>·</span>
                  <span dir="ltr">{selected.phone}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  {statusBadge(selected.status)}
                  {selected.topic && <Badge variant="outline">{selected.topic}</Badge>}
                  <Badge variant="outline">{selected.type}</Badge>
                </div>
                <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 leading-relaxed">
                  {selected.message}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(selected.createdAt, locale)}
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                {selected.status !== "ARCHIVED" && (
                  <Button
                    variant="outline"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: selected.id, status: "ARCHIVED" })}
                  >
                    <Archive className="me-2 h-4 w-4" />
                    {t("actions.archive")}
                  </Button>
                )}
                {selected.status === "ARCHIVED" && (
                  <Button
                    variant="outline"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: selected.id, status: "READ" })}
                  >
                    <Check className="me-2 h-4 w-4" />
                    {t("actions.restore")}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setSelectedId(null)}>
                  {t("actions.close")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
