"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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
import { BrandLogo } from "@/components/brand/brand-logo";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";

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
    if (!newPassword.trim()) {
      toast.error(t("required"));
      return;
    }
    resetPassword.mutate({
      token,
      newPassword,
      confirmPassword,
    });
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">{t("title")}</CardTitle>
          <CardDescription className="text-center">{t("missingToken")}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/auth/forgot-password">{t("requestNewLink")}</Link>
          </Button>
        </CardFooter>
      </Card>
    );
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
              <BrandLogo className="h-10" priority />
            </Link>
          </div>
          <CardTitle className="text-2xl text-center font-semibold uppercase tracking-wide">
            {t("title")}
          </CardTitle>
          <CardDescription className="text-center">{t("description")}</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("newPasswordLabel")} *</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={resetPassword.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")} *</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={resetPassword.isPending}
              />
              {confirmPassword && newPassword !== confirmPassword ? (
                <p className="text-xs text-destructive">{t("mismatch")}</p>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={resetPassword.isPending || newPassword !== confirmPassword}
            >
              {resetPassword.isPending ? t("submitting") : t("submitButton")}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              <Link href="/auth/login" className="text-primary hover:underline">
                {t("backToLogin")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
}
