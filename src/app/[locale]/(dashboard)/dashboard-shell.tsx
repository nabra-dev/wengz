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
} from "lucide-react";
import { useState } from "react";
import { getInitials } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";

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
  { href: "/admin", labelKey: "admin.dashboard", icon: LayoutDashboard },
  { href: "/admin/users", labelKey: "admin.users", icon: Users },
  { href: "/admin/requests", labelKey: "admin.requests", icon: FileText },
  { href: "/admin/payments", labelKey: "admin.payments", icon: CheckCircle },
  { href: "/admin/finance", labelKey: "admin.finance", icon: Wallet },
  { href: "/admin/activity", labelKey: "admin.activity", icon: ScrollText },
  { href: "/admin/notifications", labelKey: "admin.notifications", icon: Bell },
  { href: "/admin/packages", labelKey: "admin.packages", icon: CreditCard },
  { href: "/admin/services", labelKey: "admin.services", icon: Settings },
  { href: "/admin/settings", labelKey: "admin.settings", icon: Settings2 },
  { href: "/admin/profile", labelKey: "admin.profile", icon: User },
];

export function DashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { unreadCount } = useRealtimeNotifications();
  const tNav = useTranslations("dashboard.nav");

  const role = session?.user?.role;

  const getNavItems = () => {
    if (role === "SUPER_ADMIN")
      return adminNavConfig.map((item) => ({ ...item, label: tNav(item.labelKey) }));
    if (role === "PROVIDER")
      return providerNavConfig.map((item) => ({ ...item, label: tNav(item.labelKey) }));
    return clientNavConfig.map((item) => ({ ...item, label: tNav(item.labelKey) }));
  };

  const getBasePath = () => {
    if (role === "SUPER_ADMIN") return "/admin";
    if (role === "PROVIDER") return "/provider";
    return "/client";
  };

  const navItems = getNavItems();
  const basePath = getBasePath();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-50 flex h-14 sm:h-16 items-center gap-3 sm:gap-4 border-b bg-background px-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-9 w-9 sm:h-10 sm:w-10"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          ) : (
            <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
          )}
        </Button>
        <Link href={basePath} className="flex items-center gap-2 flex-1">
          <BrandLogo className="h-6 sm:h-7" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
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
              <BrandLogo className="h-6 sm:h-7" />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 sm:space-y-1 px-2 sm:px-3 py-3 sm:py-4 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const isNotifications = item.href.includes("/notifications");
              const showBadge = isNotifications && unreadCount > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors ${
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

          <Separator />

          {/* User section */}
          <div className="p-3 sm:p-4">
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
                    className="text-[10px] sm:text-xs text-muted-foreground truncate rtl:text-right"
                  >
                    {session?.user?.phone}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <ThemeSwitcher />
              <LanguageSwitcher />
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs sm:text-sm flex items-center gap-2"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
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
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden cursor-default"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ps-64 min-h-screen">
        <div className="p-3 sm:p-4 md:p-6">
          <NotificationPermissionBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
