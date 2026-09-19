"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import superjson from "superjson";
import { trpc } from "@/lib/trpc/client";

function getBaseUrl() {
  if (globalThis.window !== undefined) return "";
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return `http://localhost:${process.env.PORT ?? 3001}`;
}

/** Prevent stacked 401s from firing multiple sign-outs. */
let handlingUnauthorized = false;

function isUnauthorizedError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) return false;
  const data = error.data as { code?: string } | undefined;
  return data?.code === "UNAUTHORIZED";
}

/**
 * Deactivated / deleted users still hold a JWT, so the dashboard shell stays
 * mounted while every protected procedure returns 401. Force sign-out so they
 * cannot remain inside the app with a dead session.
 */
function handleUnauthorizedSession(error: unknown) {
  if (globalThis.window === undefined || handlingUnauthorized) return;
  if (!isUnauthorizedError(error)) return;

  const path = globalThis.window.location.pathname;
  if (path.includes("/auth/")) return;

  handlingUnauthorized = true;
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Your account is no longer active. Please sign in again.";
  toast.error(message);

  const callbackUrl = `${globalThis.window.location.origin}/auth/login`;
  void signOut({ callbackUrl }).finally(() => {
    // Allow a later login session to handle 401s again if needed.
    handlingUnauthorized = false;
  });
}

interface Props {
  readonly children: React.ReactNode;
}

export function TRPCProvider({ children }: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => handleUnauthorizedSession(error),
        }),
        mutationCache: new MutationCache({
          onError: (error) => handleUnauthorizedSession(error),
        }),
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
