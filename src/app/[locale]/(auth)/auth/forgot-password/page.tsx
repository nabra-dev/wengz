"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCompactCard, authFieldClass } from "@/components/auth/auth-form-shell";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success(t("successTitle"), { description: t("successDescription") });
    },
    onError: (err) => {
      showError(err, t("errorFallback"));
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    requestReset.mutate({ email: email.trim().toLowerCase() });
  }

  return (
    <AuthCompactCard title={t("title")} description={t("description")}>
      {submitted ? (
        <div className="space-y-5">
          <p className="text-center text-sm text-muted-foreground">{t("successDescription")}</p>
          <Button asChild variant="outline" className="h-12 w-full rounded-xl">
            <Link href="/auth/login">{t("backToLogin")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={requestReset.isPending}
              className={authFieldClass}
            />
          </div>
          <Button
            type="submit"
            className="h-12 w-full gap-2 rounded-xl text-sm font-semibold"
            disabled={requestReset.isPending}
          >
            {requestReset.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("submitting")}
              </>
            ) : (
              t("submitButton")
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/auth/login" className="font-medium text-primary hover:underline">
              {t("backToLogin")}
            </Link>
          </p>
        </form>
      )}
    </AuthCompactCard>
  );
}
