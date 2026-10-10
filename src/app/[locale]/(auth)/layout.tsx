import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/providers/session-provider";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { LandingHeader } from "@/components/landing/landing-header";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AuthProvider>
      <TRPCProvider>
        <div className="relative min-h-screen bg-background">
          <LandingHeader />

          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
            <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
            <div className="absolute bottom-0 end-[-80px] h-[320px] w-[320px] rounded-full bg-[#E0F840]/10 blur-3xl" />
          </div>

          <div className="mx-auto w-full max-w-5xl px-4 pb-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] pt-[calc(5.75rem+env(safe-area-inset-top,0px))] sm:px-6 sm:pb-16 sm:pt-[calc(7rem+env(safe-area-inset-top,0px))]">
            {children}
          </div>
        </div>
      </TRPCProvider>
    </AuthProvider>
  );
}
