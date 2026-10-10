"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthCompactCard, authFieldClass } from "@/components/auth/auth-form-shell";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";
import { passwordSchema } from "@/lib/validations";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams?.get("token")?.trim() || "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success(t("successTitle"), { description: t("successDescription") });
      router.push("/auth/login");
    },
    onError: (err) => {
      showError(err, t("errorFallback"));
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error(t("missingToken"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("mismatch"));
      return;
    }
    const passwordValidation = passwordSchema.safeParse(newPassword);
    if (!passwordValidation.success) {
      toast.error(passwordValidation.error.errors[0]?.message || t("required"));
      return;
    }
    resetPassword.mutate({
      token,
      newPassword: passwordValidation.data,
      confirmPassword: passwordValidation.data,
    });
  }

  if (!token) {
    return (
      <AuthCompactCard title={t("title")} description={t("missingToken")}>
        <Button asChild className="h-12 w-full rounded-xl text-sm font-semibold">
          <Link href="/auth/forgot-password">{t("requestNewLink")}</Link>
        </Button>
      </AuthCompactCard>
    );
  }

  return (
    <AuthCompactCard title={t("title")} description={t("description")}>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="newPassword">
            {t("newPasswordLabel")}
            <span className="ms-1 text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={resetPassword.isPending}
            className={authFieldClass}
          />
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
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={resetPassword.isPending}
            className={authFieldClass}
          />
          {confirmPassword && newPassword !== confirmPassword ? (
            <p className="text-xs text-destructive">{t("mismatch")}</p>
          ) : null}
        </div>
        <Button
          type="submit"
          className="h-12 w-full gap-2 rounded-xl text-sm font-semibold"
          disabled={resetPassword.isPending || newPassword !== confirmPassword}
        >
          {resetPassword.isPending ? (
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
    </AuthCompactCard>
  );
}
