"use client";

import { Link } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n";
import {
  Users,
  FileText,
  Package,
  Settings,
  DollarSign,
  TrendingUp,
  Star,
  Clock,
  CheckCircle,
  ArrowUpRight,
  CreditCard,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const COLORS = ["#690DD4", "#E0F840", "#9B4DFF", "#C8F060", "#4A1A8A", "#F4FF8A"];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#c09040",
  IN_PROGRESS: "#690DD4",
  DELIVERED: "#E0F840",
  REVISION_REQUESTED: "#c07040",
  COMPLETED: "#509060",
  CANCELLED: "#c04040",
};

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.admin.getStats.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { data: analytics, isLoading: analyticsLoading } = trpc.admin.getAnalytics.useQuery(
    undefined,
    { staleTime: 60_000 }
  );
  const { data: subscriptionsData, isLoading: subsLoading } =
    trpc.admin.getAllSubscriptions.useQuery(
      { limit: 5 },
      { staleTime: 60_000 }
    );
  const t = useTranslations("admin.dashboard");
  const locale = useLocale();

  const renderTopProviders = () => {
    if (analyticsLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }
    if ((analytics?.topProviders?.length || 0) === 0) {
      return (
        <p className="text-center text-muted-foreground py-8">{t("charts.noCompletedRequests")}</p>
      );
    }
    return (
      <div className="space-y-4">
        {analytics?.topProviders?.map(
          (provider: { name: string; completedRequests: number }, index: number) => (
            <div
              key={`${provider.name}-${index}`}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {index + 1}
                </div>
                <span className="font-medium">{provider.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="font-bold">{provider.completedRequests}</span>
              </div>
            </div>
          )
        )}
      </div>
    );
  };

  const renderRecentSubscriptions = () => {
    if (subsLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }
    if ((subscriptionsData?.subscriptions?.length || 0) === 0) {
      return (
        <p className="text-center text-muted-foreground py-8">{t("charts.noSubscriptions")}</p>
      );
    }
    return (
      <div className="space-y-4">
        {subscriptionsData?.subscriptions?.map(
          (sub: {
            id: string;
            user: { name: string | null; email: string };
            package: { name: string; price: number; nameI18n?: any };
            remainingCredits: number;
          }) => (
            <div key={sub.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">{sub.user.name || sub.user.email}</p>
                <p className="text-sm text-muted-foreground">
                  {resolveLocalizedText(sub.package.nameI18n, locale, sub.package.name)}
                </p>
              </div>
              <div className="text-end">
                <p className="font-bold">${sub.package.price}</p>
                <p className="text-xs text-muted-foreground">
                  {sub.remainingCredits} {t("stats.creditsLeft")}
                </p>
              </div>
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/users">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("stats.totalUsers")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.clients} {t("stats.clients")}, {stats?.providers} {t("stats.providers")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/requests">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("stats.totalRequests")}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.totalRequests || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.activeRequests} {t("stats.active")}, {stats?.completedRequests}{" "}
                    {t("stats.completed")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.totalRevenue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">${stats?.totalRevenue || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.activeSubscriptions} {t("stats.activeSubscriptions")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.averageRating")}</CardTitle>
            <Star className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{(stats?.averageRating ?? 0).toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.serviceTypes ?? 0} {t("stats.activeServiceTypes")}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Revenue Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t("charts.revenueTrend")}
            </CardTitle>
            <CardDescription>{t("charts.revenueTrendDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics?.monthlyRevenue || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${value}`, "Revenue"]} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#690DD4"
                    strokeWidth={2}
                    dot={{ fill: "#690DD4" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Requests by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("charts.requestsByStatus")}
            </CardTitle>
            <CardDescription>{t("charts.requestsByStatusDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading && <Skeleton className="h-[300px] w-full" />}
            {!analyticsLoading &&
              (!analytics?.requestsByStatus || analytics.requestsByStatus.length === 0) && (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <p className="text-sm">{t("charts.noData")}</p>
                    <p className="text-xs text-muted-foreground/70">{t("charts.noDataDesc")}</p>
                  </div>
                </div>
              )}
            {!analyticsLoading &&
              analytics?.requestsByStatus &&
              analytics.requestsByStatus.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics?.requestsByStatus || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ payload }) => `${payload.status}: ${payload.count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="status"
                    >
                      {(analytics?.requestsByStatus || []).map(
                        (entry: { status: string; count: number }, index: number) => (
                          <Cell
                            key={`cell-${entry.status}`}
                            fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]}
                          />
                        )
                      )}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscriptions by Package */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("charts.subscriptionsByPackage")}
            </CardTitle>
            <CardDescription>{t("charts.subscriptionsByPackageDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading && <Skeleton className="h-[300px] w-full" />}
            {!analyticsLoading &&
              (!analytics?.subscriptionsByPackage ||
                analytics.subscriptionsByPackage.length === 0) && (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <p className="text-sm">{t("charts.noSubscriptions")}</p>
                    <p className="text-xs text-muted-foreground/70">
                      {t("charts.noSubscriptionsDesc")}
                    </p>
                  </div>
                </div>
              )}
            {!analyticsLoading &&
              analytics?.subscriptionsByPackage &&
              analytics.subscriptionsByPackage.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics?.subscriptionsByPackage || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#690DD4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </CardContent>
        </Card>

        {/* Requests by Service Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t("charts.requestsByService")}
            </CardTitle>
            <CardDescription>{t("charts.requestsByServiceDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading && <Skeleton className="h-[300px] w-full" />}
            {!analyticsLoading &&
              (!analytics?.requestsByService || analytics.requestsByService.length === 0) && (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <p className="text-sm">{t("charts.noServiceData")}</p>
                    <p className="text-xs text-muted-foreground/70">
                      {t("charts.noServiceDataDesc")}
                    </p>
                  </div>
                </div>
              )}
            {!analyticsLoading &&
              analytics?.requestsByService &&
              analytics.requestsByService.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics?.requestsByService || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="service" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#E0F840" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Users & Subscriptions Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Providers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              {t("charts.topProviders")}
            </CardTitle>
            <CardDescription>{t("charts.topProvidersDesc")}</CardDescription>
          </CardHeader>
          <CardContent>{renderTopProviders()}</CardContent>
        </Card>

        {/* Recent Subscriptions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t("charts.recentSubscriptions")}
              </CardTitle>
              <CardDescription>{t("charts.recentSubscriptionsDesc")}</CardDescription>
            </div>
            <Link href="/admin/subscriptions">
              <span className="text-sm text-primary hover:underline flex items-center gap-1">
                {t("charts.viewAll")} <ArrowUpRight className="h-3 w-3" />
              </span>
            </Link>
          </CardHeader>
          <CardContent>{renderRecentSubscriptions()}</CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("quickStats.newUsers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-primary">+{analytics?.recentUsers || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("quickStats.newRequests")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-primary">
                +{analytics?.recentRequests || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("quickStats.pendingRequests")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">
                {stats?.pendingRequests || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {t("quickStats.completedRequests")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-primary">{stats?.completedRequests || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/users">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t("navigation.manageUsers")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t("navigation.manageUsersDesc")}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/requests">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t("navigation.manageRequests")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t("navigation.manageRequestsDesc")}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/packages">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t("navigation.managePackages")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t("navigation.managePackagesDesc")}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/services">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("navigation.manageServices")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t("navigation.manageServicesDesc")}</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
