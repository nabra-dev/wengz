"use client";

import dynamic from "next/dynamic";
import { TRPCProvider } from "@/components/providers/trpc-provider";

const LandingPage = dynamic(() => import("@/components/landing/landing-page"), {
  ssr: true,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
    </div>
  ),
});

export function LandingClient() {
  return (
    <TRPCProvider>
      <LandingPage />
    </TRPCProvider>
  );
}
