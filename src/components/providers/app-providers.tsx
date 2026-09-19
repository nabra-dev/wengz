"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/providers/session-provider";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { NotificationProvider } from "@/components/providers/notification-provider";

/**
 * Authenticated app shell providers (session, tRPC, notifications).
 * Kept off marketing routes so public pages avoid session/SSE client weight.
 */
export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AuthProvider>
      <TRPCProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </TRPCProvider>
    </AuthProvider>
  );
}
