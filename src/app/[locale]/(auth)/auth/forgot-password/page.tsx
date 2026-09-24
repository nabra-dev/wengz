"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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
        {submitted ? (
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">{t("successDescription")}</p>
            <Button asChild className="w-full" variant="outline">
              <Link href="/auth/login">{t("backToLogin")}</Link>
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={onSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("emailLabel")} *</Label>
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
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={requestReset.isPending}>
                {requestReset.isPending ? t("submitting") : t("submitButton")}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                <Link href="/auth/login" className="text-primary hover:underline">
                  {t("backToLogin")}
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </motion.div>
  );
}
