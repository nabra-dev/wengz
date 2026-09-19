"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Lazy-load recharts-heavy admin dashboard charts (keeps initial admin JS smaller). */
export const AdminDashboardCharts = dynamic(
  () => import("./admin-dashboard-charts").then((m) => m.AdminDashboardCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[360px] w-full lg:col-span-2" />
        <Skeleton className="h-[360px] w-full" />
        <Skeleton className="h-[360px] w-full" />
        <Skeleton className="h-[360px] w-full" />
      </div>
    ),
  }
);
