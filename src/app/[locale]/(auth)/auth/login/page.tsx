"use client";

import { useState, useEffect } from "react";
import { signIn, getSession, useSession } from "next-auth/react";
import { Link, useRouter } from "@/i18n/routing";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONTINUE_NEW_REQUEST_PATH, parseContinuePath } from "@/lib/landing-request-draft";
import { getStaffHomePath, isStaffRole } from "@/lib/roles";
import { trpc } from "@/lib/trpc/client";
import { BrandLogo } from "@/components/brand/brand-logo";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("auth.login");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const continuePath = parseContinuePath(searchParams?.get("continue") ?? null);
  const { data: appState } = trpc.admin.getPublicAppState.useQuery();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (session.user.role === "CLIENT" && continuePath === CONTINUE_NEW_REQUEST_PATH) {
      router.replace("/client/requests/new");
      return;
    }
    if (isStaffRole(session.user.role)) {
      router.push(`/${locale}${getStaffHomePath(session.user.role)}`);
    } else if (session.user.role === "PROVIDER") {
      router.push(`/${locale}/provider`);
    } else {
      router.push(`/${locale}/client`);
    }
  }, [status, session, router, locale, continuePath]);

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render login form if already authenticated
  if (status === "authenticated") {
    return null;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const maintenanceBlocked =
          result.error.includes("MAINTENANCE_MODE") || (appState?.maintenanceMode ?? false);
        if (maintenanceBlocked) {
          toast.error(t("maintenanceLoginBlocked"), {
            description: t("maintenanceLoginBlockedDesc"),
          });
          setIsLoading(false);
          return;
        }
        toast.error(t("loginFailed"), {
          description: t("invalidCredentials"),
        });
        setIsLoading(false);
        return;
      }

      // Get the updated session to determine user role
      const session = await getSession();

      toast.success(t("welcomeBack"), {
        description: t("successLogin"),
      });

      const afterLoginContinue = parseContinuePath(searchParams?.get("continue") ?? null);
      if (session?.user?.role === "CLIENT" && afterLoginContinue === CONTINUE_NEW_REQUEST_PATH) {
        globalThis.location.href = `/${locale}/client/requests/new`;
        return;
      }

      // Redirect based on user role with full page reload to ensure proper session initialization
      if (isStaffRole(session?.user?.role)) {
        globalThis.location.href = `/${locale}${getStaffHomePath(session?.user?.role)}`;
      } else if (session?.user?.role === "PROVIDER") {
        globalThis.location.href = `/${locale}/provider`;
      } else {
        globalThis.location.href = `/${locale}/client`;
      }
    } catch (err) {

      toast.error(t("error"), {
        description: t("errorMessage"),
      });
      setIsLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Link href="/" className="flex items-center space-x-2">
              <motion.div whileHover={{ scale: 1.1 }}>
                <BrandLogo className="h-10" priority />
              </motion.div>
            </Link>
          </div>
          <CardTitle className="text-2xl text-center font-semibold uppercase tracking-wide">
            {t("title")}
          </CardTitle>
          <CardDescription className="text-center">{t("description")}</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {appState?.maintenanceMode && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                {t("maintenanceNote")}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailLabel")} *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">{t("passwordLabel")} *</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <motion.div className="w-full" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("signingIn") : t("signInButton")}
              </Button>
            </motion.div>
            {/*
            <p className="text-sm text-muted-foreground text-center">
              {t("noAccount")}{" "}
              <Link
                href={
                  continuePath
                    ? `/auth/register?continue=${encodeURIComponent(continuePath)}`
                    : "/auth/register"
                }
                className="text-primary hover:underline"
              >
                {t("signUp")}
              </Link>
            </p>
            */}
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
}
