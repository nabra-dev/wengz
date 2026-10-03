"use client";

import { useSession, signOut } from "next-auth/react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { NotificationPermissionBanner } from "@/components/ui/notification-permission-banner";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { CurrencySwitcher } from "@/components/ui/currency-switcher";
import { PwaInstallButton } from "@/components/ui/pwa-install-button";
import { useRealtimeNotifications } from "@/components/providers/notification-provider";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Bell,
  Settings,
  User,
  Users,
  Workflow,
  LogOut,
  Menu,
  X,
  Wallet,
  CheckCircle,
  Settings2,
  ScrollText,
  Plus,
  MessageSquare,
  ShieldAlert,
  Receipt,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getInitials } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";
import { trpc } from "@/lib/trpc/client";
import {
  canManageFinance,
  canManagePlatform,
  canManageRequests,
  getStaffHomePath,
  isStaffRole,
} from "@/lib/roles";

function isNavItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  // Role home paths should not match every nested route
  if (href === "/client" || href === "/provider" || href === "/admin") return false;
  return pathname.startsWith(`${href}/`);
}

const clientNavConfig = [
  { href: "/client", labelKey: "client.dashboard", icon: LayoutDashboard },
  { href: "/client/requests", labelKey: "client.requests", icon: FileText },
  { href: "/client/subscription", labelKey: "client.subscription", icon: CreditCard },
  { href: "/client/payment", labelKey: "client.payment", icon: Wallet },
  { href: "/client/notifications", labelKey: "client.notifications", icon: Bell },
  { href: "/client/profile", labelKey: "client.profile", icon: User },
];

const providerNavConfig = [
  { href: "/provider", labelKey: "provider.dashboard", icon: LayoutDashboard },
  { href: "/provider/available", labelKey: "provider.available", icon: Workflow },
  { href: "/provider/my-requests", labelKey: "provider.myRequests", icon: FileText },
  { href: "/provider/wallet", labelKey: "provider.wallet", icon: Wallet },
  { href: "/provider/notifications", labelKey: "provider.notifications", icon: Bell },
  { href: "/provider/profile", labelKey: "provider.profile", icon: User },
];

const adminNavConfig = [
  {
    href: "/admin",
    labelKey: "admin.dashboard",
    icon: LayoutDashboard,
    access: "platform" as const,
  },
  { href: "/admin/users", labelKey: "admin.users", icon: Users, access: "platform" as const },
  {
    href: "/admin/requests",
    labelKey: "admin.requests",
    icon: FileText,
    access: "requests" as const,
  },
  {
    href: "/admin/contact-leaks",
    labelKey: "admin.contactLeaks",
    icon: ShieldAlert,
    access: "requests" as const,
  },
  {
    href: "/admin/payments",
    labelKey: "admin.payments",
    icon: CheckCircle,
    access: "finance" as const,
  },
  { href: "/admin/finance", labelKey: "admin.finance", icon: Wallet, access: "finance" as const },
  {
    href: "/admin/subscriptions",
    labelKey: "admin.subscriptions",
    icon: Receipt,
    access: "finance" as const,
  },
  {
    href: "/admin/activity",
    labelKey: "admin.activity",
    icon: ScrollText,
    access: "platform" as const,
  },
  {
    href: "/admin/contacts",
    labelKey: "admin.contacts",
    icon: MessageSquare,
    access: "platform" as const,
  },
  {
    href: "/admin/notifications",
    labelKey: "admin.notifications",
    icon: Bell,
    access: "staff" as const,
  },
  {
    href: "/admin/packages",
    labelKey: "admin.packages",
    icon: CreditCard,
    access: "platform" as const,
  },
  {
    href: "/admin/services",
    labelKey: "admin.services",
    icon: Settings,
    access: "platform" as const,
  },
  {
    href: "/admin/settings",
    labelKey: "admin.settings",
    icon: Settings2,
    access: "settings" as const,
  },
  { href: "/admin/profile", labelKey: "admin.profile", icon: User, access: "staff" as const },
];

function canSeeAdminNavItem(
  role: string | null | undefined,
  access: (typeof adminNavConfig)[number]["access"]
) {
  if (access === "staff") return isStaffRole(role);
  if (access === "requests") return canManageRequests(role);
  if (access === "finance") return canManageFinance(role);
  if (access === "settings") return canManagePlatform(role) || canManageFinance(role);
  return canManagePlatform(role);
}

export function DashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: session, status: sessionStatus } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { unreadCount } = useRealtimeNotifications();
  const tNav = useTranslations("dashboard.nav");

  // While session is loading, infer role from the URL so the sidebar does not
  // briefly flash the client nav on admin/provider routes.
  const roleFromPath = (() => {
    if (pathname.startsWith("/admin")) return "SUPER_ADMIN" as const;
    if (pathname.startsWith("/provider")) return "PROVIDER" as const;
    if (pathname.startsWith("/client")) return "CLIENT" as const;
    return null;
  })();
  const role = session?.user?.role ?? (sessionStatus === "loading" ? roleFromPath : null);

  const isClient = role === "CLIENT";
  const { data: clientSubscription, isFetched: clientCreditsFetched } =
    trpc.subscription.getActive.useQuery(undefined, {
      enabled: isClient && sessionStatus === "authenticated",
      refetchOnWindowFocus: true,
    });
  const clientCredits =
    isClient && clientCreditsFetched ? (clientSubscription?.remainingCredits ?? 0) : null;
  const creditsLow = clientCredits !== null && clientCredits <= 0;

  const getNavItems = () => {
    if (isStaffRole(role)) {
      return adminNavConfig
        .filter((item) => canSeeAdminNavItem(role, item.access))
        .map((item) => ({ ...item, label: tNav(item.labelKey) }));
    }
    if (role === "PROVIDER")
      return providerNavConfig.map((item) => ({ ...item, label: tNav(item.labelKey) }));
    if (role === "CLIENT")
      return clientNavConfig.map((item) => ({ ...item, label: tNav(item.labelKey) }));
    return [];
  };

  const getBasePath = () => {
    if (isStaffRole(role)) return getStaffHomePath(role);
    if (role === "PROVIDER") return "/provider";
    if (role === "CLIENT") return "/client";
    return "/";
  };

  const navItems = getNavItems();
  const basePath = getBasePath();
  const notificationsHref = isClient
    ? "/client/notifications"
    : role === "PROVIDER"
      ? "/provider/notifications"
      : isStaffRole(role)
        ? "/admin/notifications"
        : null;

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-50 flex h-14 sm:h-16 items-center gap-1.5 border-b bg-background px-2 sm:px-3 pt-[env(safe-area-inset-top)]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? tNav("closeMenu") : tNav("openMenu")}
          aria-expanded={sidebarOpen}
          className="h-10 w-10 shrink-0"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        <Link href={basePath} className="flex shrink-0 items-center me-auto pe-1">
          <BrandLogo className="h-7 sm:h-8" />
        </Link>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {isClient && (
            <Button
              asChild
              size="icon"
              className="h-10 w-10 shrink-0 shadow-sm"
              title={tNav("newRequest")}
            >
              <Link href="/client/requests/new" aria-label={tNav("newRequest")}>
                <Plus className="h-5 w-5" />
              </Link>
            </Button>
          )}

          {clientCredits !== null && (
            <Link
              href="/client/subscription"
              className={
                creditsLow
                  ? "inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  : "inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              }
              aria-label={tNav("creditsCount", { count: clientCredits })}
            >
              <CreditCard
                className={
                  creditsLow
                    ? "h-3.5 w-3.5 shrink-0 text-destructive"
                    : "h-3.5 w-3.5 shrink-0 text-primary"
                }
              />
              <span className="text-sm font-semibold tabular-nums leading-none">
                {clientCredits}
              </span>
            </Link>
          )}

          {notificationsHref && (
            <Link
              href={notificationsHref}
              className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={
                unreadCount > 0
                  ? tNav("unreadNotifications", { count: unreadCount })
                  : tNav("client.notifications")
              }
              onClick={() => setSidebarOpen(false)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 w-64 sm:w-72 lg:w-64 transform bg-background border-e transition-transform duration-200 ease-in-out lg:translate-x-0 rtl:lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0 rtl:translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 sm:h-16 items-center gap-2 border-b px-4 sm:px-6">
            <Link href={basePath} className="flex items-center gap-2">
              <BrandLogo className="h-8 sm:h-9" />
            </Link>
          </div>

          {/* Client CTA — pinned above scrollable nav so it stays visible */}
          {isClient && (
            <div className="shrink-0 border-b px-2 sm:px-3 py-2.5 sm:py-3">
              <Button
                asChild
                size="sm"
                className={`w-full justify-center gap-2 font-semibold shadow-sm ${
                  pathname.startsWith("/client/requests/new")
                    ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                    : ""
                }`}
              >
                <Link href="/client/requests/new" onClick={() => setSidebarOpen(false)}>
                  <Plus className="h-4 w-4 shrink-0" />
                  {tNav("newRequest")}
                </Link>
              </Button>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 sm:space-y-1 px-2 sm:px-3 py-3 sm:py-4 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              const isNotifications = item.href.includes("/notifications");
              const showBadge = isNotifications && unreadCount > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex min-h-11 items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {showBadge && (
                    <Badge
                      variant="destructive"
                      className="ms-auto h-4 sm:h-5 min-w-4 sm:min-w-5 flex items-center justify-center px-1 text-[10px] sm:text-xs"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {clientCredits !== null && (
            <>
              <Separator />
              <div className="px-2 sm:px-3 py-2 sm:py-3">
                <Link
                  href="/client/subscription"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors ${
                    creditsLow
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
                      : "bg-muted/60 text-foreground hover:bg-muted"
                  }`}
                >
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="flex-1">{tNav("credits")}</span>
                  <span className="tabular-nums font-semibold">{clientCredits}</span>
                </Link>
              </div>
            </>
          )}

          <Separator />

          {/* User section */}
          <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                <AvatarImage src={session?.user?.image || ""} className="object-cover" />
                <AvatarFallback className="text-xs sm:text-sm">
                  {getInitials(session?.user?.name || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs sm:text-sm font-medium truncate">{session?.user?.name}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {session?.user?.email}
                </p>
                {session?.user?.phone && (
                  <p
                    dir="ltr"
                    className="text-[10px] sm:text-xs text-muted-foreground truncate rtl:text-start"
                  >
                    {session?.user?.phone}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-evenly gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-1">
                <ThemeSwitcher />
                <CurrencySwitcher variant="icon" className="h-8 min-w-0 shrink px-2 sm:h-9" />
                <LanguageSwitcher variant="icon" />
                {/* PWA install prompt is unreliable on mobile browsers — desktop only. */}
                <PwaInstallButton className="hidden h-8 w-8 shrink-0 text-foreground hover:text-foreground lg:inline-flex sm:h-9 sm:w-9" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs text-muted-foreground hover:text-foreground sm:text-sm"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="me-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {tNav("signOut")}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label={tNav("closeSidebar")}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden cursor-default"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ps-64 min-h-screen min-w-0">
        <div className="p-3 sm:p-4 md:p-6">
          <NotificationPermissionBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
