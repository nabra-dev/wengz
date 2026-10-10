"use client";

import { useState, useEffect } from "react";
import { signIn, getSession, useSession } from "next-auth/react";
import { Link, useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormShell, authFieldClass } from "@/components/auth/auth-form-shell";
import { CONTINUE_NEW_REQUEST_PATH, parseContinuePath } from "@/lib/landing-request-draft";
import { getStaffHomePath, isStaffRole } from "@/lib/roles";
import { trpc } from "@/lib/trpc/client";
import { loginFormSchema } from "@/lib/validations";

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

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const parsed = loginFormSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      toast.error(t("loginFailed"), {
        description: parsed.error.errors[0]?.message || t("invalidCredentials"),
      });
      setIsLoading(false);
      return;
    }
    const { email, password } = parsed.data;

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
        if (result.error.includes("ACCOUNT_PENDING_APPROVAL")) {
          toast.error(t("pendingApproval"), {
            description: t("pendingApprovalDesc"),
          });
          setIsLoading(false);
          return;
        }
        if (result.error.includes("ACCOUNT_REJECTED")) {
          const reasonMatch = result.error.match(/ACCOUNT_REJECTED:([^|]*)/);
          let reason = "";
          if (reasonMatch?.[1]) {
            try {
              reason = decodeURIComponent(reasonMatch[1]);
            } catch {
              reason = reasonMatch[1];
            }
          }
          toast.error(t("accountRejected"), {
            description: reason ? t("accountRejectedReason", { reason }) : t("accountRejectedDesc"),
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

      const nextSession = await getSession();

      toast.success(t("welcomeBack"), {
        description: t("successLogin"),
      });

      const afterLoginContinue = parseContinuePath(searchParams?.get("continue") ?? null);
      if (
        nextSession?.user?.role === "CLIENT" &&
        afterLoginContinue === CONTINUE_NEW_REQUEST_PATH
      ) {
        globalThis.location.href = `/${locale}/client/requests/new`;
        return;
      }

      if (isStaffRole(nextSession?.user?.role)) {
        globalThis.location.href = `/${locale}${getStaffHomePath(nextSession?.user?.role)}`;
      } else if (nextSession?.user?.role === "PROVIDER") {
        globalThis.location.href = `/${locale}/provider`;
      } else {
        globalThis.location.href = `/${locale}/client`;
      }
    } catch {
      toast.error(t("error"), {
        description: t("errorMessage"),
      });
      setIsLoading(false);
    }
  }

  return (
    <AuthFormShell
      badge={
        <>
          <LogIn className="h-3.5 w-3.5 text-primary" aria-hidden />
          {t("badge")}
        </>
      }
      title={t("title")}
      subtitle={t("subtitle")}
      asideExtras={
        <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/50 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("asideNote")}</p>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {appState?.maintenanceMode && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            {t("maintenanceNote")}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">
            {t("emailLabel")}
            <span className="ms-1 text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            required
            disabled={isLoading}
            className={authFieldClass}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">
              {t("passwordLabel")}
              <span className="ms-1 text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={isLoading}
            className={authFieldClass}
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="h-12 w-full gap-2 rounded-xl text-sm font-semibold"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("signingIn")}
            </>
          ) : (
            t("signInButton")
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link
            href={
              continuePath
                ? `/auth/register?continue=${encodeURIComponent(continuePath)}`
                : "/auth/register"
            }
            className="font-medium text-primary hover:underline"
          >
            {t("signUp")}
          </Link>
        </p>
      </form>
    </AuthFormShell>
  );
}
