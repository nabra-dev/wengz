"use client";

import dynamic from "next/dynamic";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import type { PublicPackage } from "@/lib/public-packages";

const LandingPage = dynamic(() => import("@/components/landing/landing-page"), {
  ssr: true,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
    </div>
  ),
});

export function LandingClient({ initialPackages = [] }: { initialPackages?: PublicPackage[] }) {
  return (
    <TRPCProvider>
      <LandingPage initialPackages={initialPackages} />
    </TRPCProvider>
  );
}
