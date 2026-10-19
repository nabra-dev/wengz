"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Link, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Briefcase, Loader2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthFormShell, authFieldClass } from "@/components/auth/auth-form-shell";
import { PhoneCountrySelect } from "@/components/forms/phone-country-select";
import { trpc } from "@/lib/trpc/client";
import { phoneNumberOnlySchema, registerFormSchema } from "@/lib/validations";
import { CONTINUE_NEW_REQUEST_PATH, parseContinuePath } from "@/lib/landing-request-draft";
import { getStaffHomePath, isStaffRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

type RegisterStep = "choose" | "client";

export default function RegisterPage() {
  const router = useRouter();
  const locale = useLocale();
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const [step, setStep] = useState<RegisterStep>("choose");
  const t = useTranslations("auth.register");
  const tFields = useTranslations("forms.fields");
  const searchParams = useSearchParams();
  const continueAfterAuth = parseContinuePath(searchParams?.get("continue") ?? null);
  const roleParam = searchParams?.get("role");

  useEffect(() => {
    if (roleParam === "client") {
      setStep("client");
      return;
    }
    if (roleParam === "provider" || roleParam === "creator") {
      const qs = continueAfterAuth ? `?continue=${encodeURIComponent(continueAfterAuth)}` : "";
      router.replace(`/forms/provider${qs}`);
    }
  }, [roleParam, router, continueAfterAuth]);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      toast.success(t("accountCreated"), {
        description: data.reapplied ? t("reapplySuccess") : t("successMessage"),
      });
      const qs = new URLSearchParams({ registered: "true" });
      if (continueAfterAuth) {
        qs.set("continue", continueAfterAuth);
      }
      router.push(`/auth/login?${qs.toString()}`);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(t("registrationFailed"), {
        description: err.message,
      });
    },
  });

  const [countryCode, setCountryCode] = useState("+20");
  const [phoneInput, setPhoneInput] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (session.user.role === "CLIENT" && continueAfterAuth === CONTINUE_NEW_REQUEST_PATH) {
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
  }, [status, session, router, locale, continueAfterAuth]);

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
    setError("");

    const formData = new FormData(e.currentTarget);
    const phoneRaw = (formData.get("phone") as string).trim() || "";

    const parsed = registerFormSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) {
      const errorMsg =
        parsed.error.errors[0]?.message ||
        (parsed.error.errors[0]?.path?.[0] === "confirmPassword"
          ? t("passwordsNotMatch")
          : t("passwordHint"));
      setError(errorMsg);
      toast.error(t("validationError"), {
        description: errorMsg,
      });
      return;
    }

    let phone: string | undefined = undefined;
    if (phoneRaw) {
      const phoneValidation = phoneNumberOnlySchema.safeParse(phoneRaw);
      if (!phoneValidation.success) {
        const errorMsg = phoneValidation.error.errors[0]?.message || t("invalidPhone");
        setError(errorMsg);
        toast.error(t("validationError"), {
          description: errorMsg,
        });
        return;
      }
      phone = `${countryCode} ${phoneRaw}`;
    }

    const { name, email, password } = parsed.data;
    registerMutation.mutate({ name, email, password, phone });
  }

  const busy = registerMutation.isPending;
  const providerHref = continueAfterAuth
    ? `/forms/provider?continue=${encodeURIComponent(continueAfterAuth)}`
    : "/forms/provider";

  if (step === "choose") {
    return (
      <AuthFormShell
        badge={
          <>
            <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
            {t("choose.badge")}
          </>
        }
        title={t("choose.title")}
        subtitle={t("choose.subtitle")}
      >
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">{t("choose.stepLabel")}</p>

          <button
            type="button"
            onClick={() => setStep("client")}
            className="group flex w-full items-start gap-4 rounded-2xl border border-border/70 bg-background/60 p-4 text-start transition-colors hover:border-primary/40 hover:bg-primary/[0.04] sm:p-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <UserPlus className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-foreground">
                  {t("choose.clientTitle")}
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-80 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  aria-hidden
                />
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t("choose.clientDescription")}
              </span>
            </span>
          </button>

          <Link
            href={providerHref}
            className="group flex w-full items-start gap-4 rounded-2xl border border-border/70 bg-background/60 p-4 text-start transition-colors hover:border-primary/40 hover:bg-primary/[0.04] sm:p-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E0F840]/20 text-foreground transition-colors group-hover:bg-[#E0F840]/30 dark:bg-[#E0F840]/15">
              <Briefcase className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-foreground">
                  {t("choose.providerTitle")}
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-80 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  aria-hidden
                />
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t("choose.providerDescription")}
              </span>
            </span>
          </Link>

          <p className="pt-2 text-center text-sm text-muted-foreground">
            {t("haveAccount")}{" "}
            <Link
              href={
                continueAfterAuth
                  ? `/auth/login?continue=${encodeURIComponent(continueAfterAuth)}`
                  : "/auth/login"
              }
              className="font-medium text-primary hover:underline"
            >
              {t("signInLink")}
            </Link>
          </p>
        </div>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell
      badge={
        <>
          <UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden />
          {t("badge")}
        </>
      }
      title={t("title")}
      subtitle={t("subtitle")}
      asideExtras={
        <button
          type="button"
          onClick={() => {
            setError("");
            setStep("choose");
          }}
          className="group flex w-full items-center gap-2 rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-background/80 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 opacity-60 rtl:rotate-180" aria-hidden />
          {t("backToChoose")}
        </button>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <p className="text-sm font-medium text-muted-foreground">{t("clientStepLabel")}</p>

        {error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="name">
            {t("nameLabel")}
            <span className="ms-1 text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder={t("namePlaceholder")}
            required
            disabled={busy}
            className={authFieldClass}
          />
        </div>

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
            disabled={busy}
            className={authFieldClass}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t("phoneLabel")}</Label>
          <div className="flex gap-2.5 rtl:flex-row-reverse">
            <PhoneCountrySelect
              value={countryCode}
              onValueChange={setCountryCode}
              disabled={busy}
            />
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={tFields("phonePlaceholder")}
              disabled={busy}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replaceAll(/\D/g, ""))}
              pattern="\d{7,15}"
              className={cn(authFieldClass, "min-w-0 flex-1 text-base tabular-nums")}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("phoneHint")}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">
              {t("passwordLabel")}
              <span className="ms-1 text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              disabled={busy}
              className={authFieldClass}
            />
            <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {t("confirmPasswordLabel")}
              <span className="ms-1 text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              required
              disabled={busy}
              className={authFieldClass}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={busy}
          className="h-12 w-full gap-2 rounded-xl text-sm font-semibold"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("creatingAccount")}
            </>
          ) : (
            t("createAccountButton")
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link
            href={
              continueAfterAuth
                ? `/auth/login?continue=${encodeURIComponent(continueAfterAuth)}`
                : "/auth/login"
            }
            className="font-medium text-primary hover:underline"
          >
            {t("signInLink")}
          </Link>
        </p>
      </form>
    </AuthFormShell>
  );
}
