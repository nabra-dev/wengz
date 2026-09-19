"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Link, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { emailSchema, phoneNumberOnlySchema } from "@/lib/validations";
import { BrandLogo } from "@/components/brand/brand-logo";
import { CONTINUE_NEW_REQUEST_PATH, parseContinuePath } from "@/lib/landing-request-draft";

export default function RegisterPage() {
  const router = useRouter();
  const locale = useLocale();
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const t = useTranslations("auth.register");
  const searchParams = useSearchParams();
  const continueAfterAuth = parseContinuePath(searchParams?.get("continue") ?? null);

  // All hooks must be called before any conditional returns
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success(t("accountCreated"), {
        description: t("successMessage"),
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

  // Redirect if already logged in
  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (session.user.role === "CLIENT" && continueAfterAuth === CONTINUE_NEW_REQUEST_PATH) {
      router.replace("/client/requests/new");
      return;
    }
    if (session.user.role === "SUPER_ADMIN") {
      router.push(`/${locale}/admin`);
    } else if (session.user.role === "PROVIDER") {
      router.push(`/${locale}/provider`);
    } else {
      router.push(`/${locale}/client`);
    }
  }, [status, session, router, locale, continueAfterAuth]);

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render register form if already authenticated
  if (status === "authenticated") {
    return null;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = (formData.get("email") as string).toLowerCase().trim();
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const phoneRaw = (formData.get("phone") as string).trim() || "";

    // Validate email using emailSchema
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      const errorMsg = emailValidation.error.errors[0]?.message || "Invalid email";
      setError(errorMsg);
      toast.error(t("validationError"), {
        description: errorMsg,
      });
      return;
    }

    // Build phone with country code if provided
    let phone: string | undefined = undefined;
    if (phoneRaw) {
      // Validate phone number using phoneNumberOnlySchema
      const phoneValidation = phoneNumberOnlySchema.safeParse(phoneRaw);
      if (!phoneValidation.success) {
        const errorMsg = phoneValidation.error.errors[0]?.message || "Invalid phone number";
        setError(errorMsg);
        toast.error(t("validationError"), {
          description: errorMsg,
        });
        return;
      }
      phone = `${countryCode} ${phoneRaw}`;
    }

    if (password !== confirmPassword) {
      setError(t("passwordsNotMatch"));
      toast.error(t("validationError"), {
        description: t("passwordsNotMatch"),
      });
      return;
    }

    registerMutation.mutate({ name, email, password, phone });
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
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">{t("nameLabel")} *</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder={t("namePlaceholder")}
                required
                minLength={2}
                maxLength={100}
                disabled={registerMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">{t("nameHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailLabel")} *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                required
                disabled={registerMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phoneLabel")}</Label>
              <div className="flex rtl:flex-row-reverse gap-2">
                <Select
                  value={countryCode}
                  onValueChange={setCountryCode}
                  disabled={registerMutation.isPending}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+20">🇪🇬 +20</SelectItem>
                    <SelectItem value="+966">🇸🇦 +966</SelectItem>
                    <SelectItem value="+971">🇦🇪 +971</SelectItem>
                    <SelectItem value="+965">🇰🇼 +965</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder={t("phonePlaceholder")}
                  disabled={registerMutation.isPending}
                  value={phoneInput}
                  onChange={(e) => {
                    const value = e.target.value.replaceAll(/\D/g, "");
                    setPhoneInput(value);
                  }}
                  pattern="\d{7,15}"
                  title="Phone number must be 7-15 digits"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("phoneHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("passwordLabel")} *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                maxLength={100}
                disabled={registerMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")} *</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                maxLength={100}
                disabled={registerMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">{t("confirmPasswordHint")}</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <motion.div className="w-full" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? t("creatingAccount") : t("createAccountButton")}
              </Button>
            </motion.div>
            <p className="text-sm text-muted-foreground text-center">
              {t("haveAccount")}{" "}
              <Link
                href={
                  continueAfterAuth
                    ? `/auth/login?continue=${encodeURIComponent(continueAfterAuth)}`
                    : "/auth/login"
                }
                className="text-primary hover:underline"
              >
                {t("signInLink")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
}
