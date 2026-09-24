"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "@/i18n/routing";
import { useEffect } from "react";
import {
  canAccessAdminPath,
  getStaffHomePath,
  isStaffRole,
} from "@/lib/roles";

function getAdminRedirect(role?: string | null, pathWithoutLocale?: string): string | null {
  if (!role) return null;
  if (!isStaffRole(role)) {
    if (role === "PROVIDER") return "/provider";
    if (role === "CLIENT") return "/client";
    return "/";
  }
  if (pathWithoutLocale && !canAccessAdminPath(role, pathWithoutLocale)) {
    return getStaffHomePath(role);
  }
  return null;
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const pathWithoutLocale = pathname.replace(/^\//, "") || "admin";

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/login");
      return;
    }

    const redirect = getAdminRedirect(session.user?.role, pathWithoutLocale);
    if (redirect) {
      router.push(redirect);
    }
  }, [session, status, router, pathWithoutLocale]);

  const isAuthorized = !!(
    status !== "loading" &&
    session &&
    isStaffRole(session.user?.role) &&
    canAccessAdminPath(session.user?.role, pathWithoutLocale)
  );

  return isAuthorized ? children : null;
}
