"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { FileText, Package, Settings, TrendingUp } from "lucide-react";
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

interface AdminDashboardChartsProps {
  readonly analyticsLoading: boolean;
  readonly analytics?: {
    monthlyRevenue?: Array<{ month: string; revenue: number }>;
    requestsByStatus?: Array<{ status: string; count: number }>;
    subscriptionsByPackage?: Array<{ name: string; count: number }>;
    requestsByService?: Array<{ service: string; count: number }>;
  } | null;
}

export function AdminDashboardCharts({ analyticsLoading, analytics }: AdminDashboardChartsProps) {
  const t = useTranslations("admin.dashboard");

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

      <div className="grid gap-6 md:grid-cols-2">
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
    </>
  );
}
