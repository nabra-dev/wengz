import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardShell } from "./dashboard-shell";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
