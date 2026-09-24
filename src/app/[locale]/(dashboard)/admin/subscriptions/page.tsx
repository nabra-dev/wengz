"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import { formatDate } from "@/lib/utils";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import { resolveLocalizedText } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Search,
  Calendar,
  Package,
  User,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

type Subscription = {
  id: string;
  remainingCredits: number;
  startDate: string | Date;
  endDate: string | Date;
  isActive: boolean;
  cancelledAt: string | Date | null;
  createdAt: string | Date;
  user: { id: string; name: string | null; email: string; createdAt: string | Date };
  package: {
    id: string;
    name: string;
    credits: number;
    price: number;
    durationDays: number;
  };
};

export default function AdminSubscriptionsPage() {
  const t = useTranslations("admin.subscriptions");
  const locale = useLocale();
  const formatCurrency = useFormatCurrency();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = trpc.admin.getAllSubscriptions.useQuery({
    status:
      statusFilter === "all" ? undefined : (statusFilter as "active" | "expired" | "cancelled"),
  });

  const subscriptions: Subscription[] = data?.subscriptions || [];

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch =
      searchQuery === "" ||
      sub.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.package.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter((s) => s.isActive && new Date(s.endDate) >= new Date()).length,
    expired: subscriptions.filter((s) => new Date(s.endDate) < new Date()).length,
    cancelled: subscriptions.filter((s) => s.cancelledAt !== null).length,
    totalRevenue: subscriptions.reduce((sum, s) => sum + s.package.price, 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.total")}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.active")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.expired")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.expired}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.cancelled")}</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.cancelled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.totalRevenue")}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t("filters.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("filters.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full ps-10 pe-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("filters.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
                <SelectItem value="active">{t("filters.active")}</SelectItem>
                <SelectItem value="expired">{t("filters.expired")}</SelectItem>
                <SelectItem value="cancelled">{t("filters.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("list.title", { count: filteredSubscriptions.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSubscriptions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">{t("empty.title")}</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? t("empty.withFilters")
                  : t("empty.noFilters")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSubscriptions.map((sub) => {
                const isExpired = new Date(sub.endDate) < new Date();
                const isCancelled = sub.cancelledAt !== null;
                const isActive = sub.isActive && !isExpired && !isCancelled;

                return (
                  <div
                    key={sub.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{sub.user.name || sub.user.email}</h3>
                          {isActive && <Badge variant="success">{t("badges.active")}</Badge>}
                          {isExpired && <Badge variant="warning">{t("badges.expired")}</Badge>}
                          {isCancelled && (
                            <Badge variant="destructive">{t("badges.cancelled")}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{sub.user.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {resolveLocalizedText(
                              (sub.package as any).nameI18n,
                              locale,
                              sub.package.name
                            )}
                          </p>
                          <p className="text-muted-foreground">
                            {formatCurrency(sub.package.price)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {sub.remainingCredits} / {sub.package.credits}
                          </p>
                          <p className="text-muted-foreground">{t("list.creditsLeft")}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{formatDate(sub.startDate, locale)}</p>
                          <p className="text-muted-foreground">
                            {t("info.to")} {formatDate(sub.endDate, locale)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
