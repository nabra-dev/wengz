"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/routing";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function getClientRedirect(role?: string | null): string | null {
  switch (role) {
    case "PROVIDER":
      return "/provider";
    case "SUPER_ADMIN":
      return "/admin";
    case "CLIENT":
      return null; // Allow access
    default:
      return role ? "/" : null; // Redirect unknown roles to home
  }
}

function ClientAuthSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 sm:w-64" />
        <Skeleton className="h-4 w-64 sm:w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/login");
      return;
    }

    const redirect = getClientRedirect(session.user?.role);
    if (redirect) {
      router.push(redirect);
    }
  }, [session, status, router]);

  const isAuthorized = !!(
    status !== "loading" &&
    session &&
    (session.user?.role === "CLIENT" || session.user?.role === "SUPER_ADMIN")
  );

  if (!isAuthorized) {
    return <ClientAuthSkeleton />;
  }

  return children;
}
