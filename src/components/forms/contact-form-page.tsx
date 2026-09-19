"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";

const fieldClass =
  "h-11 rounded-lg border-border/80 bg-background/60 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/30";

const textareaClass =
  "min-h-[140px] resize-y rounded-lg border-border/80 bg-background/60 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/30";

export type ContactFormVariant = "client" | "provider";

/** Stable ids for provider form — labels come from `forms.provider.serviceOptions.*` */
export const PROVIDER_FORM_SERVICE_IDS = [
  "design",
  "social",
  "video",
  "ads",
  "accounts",
  "paid_campaigns",
  "digital",
  "other",
] as const;

export type ProviderFormServiceId = (typeof PROVIDER_FORM_SERVICE_IDS)[number];

interface ContactFormPageProps {
  readonly variant: ContactFormVariant;
}

interface SubmitDebugInfo {
  source: "contact-api";
  status: number;
  ok: boolean;
  contentType: string | null;
  requestId: string | null;
  bodySnippet: string;
}

async function inspectSubmissionResponse(
  source: SubmitDebugInfo["source"],
  response: Response
): Promise<SubmitDebugInfo> {
  const contentType = response.headers.get("content-type");
  const requestId =
    response.headers.get("x-request-id") ||
    response.headers.get("x-amzn-requestid") ||
    response.headers.get("cf-ray");
  const rawBody = await response
    .clone()
    .text()
    .catch(() => "");

  return {
    source,
    status: response.status,
    ok: response.ok,
    contentType,
    requestId,
    bodySnippet: rawBody.slice(0, 600),
  };
}

export function ContactFormPage({ variant }: ContactFormPageProps) {
  const t = useTranslations();
  const tSvc = useTranslations("forms.provider.serviceOptions");
  const [loading, setLoading] = useState(false);
  const submitLockRef = useRef(false);
  const prefix = variant === "client" ? "forms.client" : "forms.provider";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || submitLockRef.current) return;
    submitLockRef.current = true;
    setLoading(true);
    const formEl = e.currentTarget;

    const formData = new FormData(formEl);
    const getText = (key: string) => {
      const v = formData.get(key);
      return typeof v === "string" ? v.trim() : "";
    };
    const servicesRaw = formData.getAll("services");
    const knownIds = new Set<string>(PROVIDER_FORM_SERVICE_IDS);
    const serviceIds = servicesRaw.filter(
      (v): v is string => typeof v === "string" && knownIds.has(v)
    );
    const payload = {
      type: variant,
      fullName: getText("fullName"),
      email: getText("email"),
      whatsapp: getText("whatsapp"),
      company: getText("company"),
      website: getText("website"),
      message: getText("message"),
      services: variant === "provider" ? serviceIds : [],
    };

    try {
      let serviceLabelsForEmail = "";
      if (variant === "provider") {
        serviceLabelsForEmail =
          payload.services.length > 0
            ? payload.services.map((id) => tSvc(id as ProviderFormServiceId)).join(", ")
            : "—";
      }

      const res = await fetch("/api/forms/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          serviceLabels: serviceLabelsForEmail,
        }),
      });

      const debug = await inspectSubmissionResponse("contact-api", res);

      if (debug.ok) {
        formEl.reset();
        toast.success(t("forms.toast.sentTitle"), { description: t("forms.toast.sentDesc") });
        return;
      }

      toast.error(t("forms.toast.errorTitle"), { description: t("forms.toast.errorDesc") });
    } catch (error) {

      toast.error(t("forms.toast.errorTitle"), { description: t("forms.toast.errorDesc") });
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  const accent =
    variant === "client"
      ? {
          pitchBorder: "border-[#E0F840]/25",
          pitchBg: "from-[#E0F840]/[0.07] to-[#690DD4]/[0.05]",
          pitchAccentBar: "bg-[#E0F840]/50",
          iconBg: "bg-[#E0F840]/15 text-[#E0F840]",
        }
      : {
          pitchBorder: "border-[#690DD4]/25",
          pitchBg: "from-[#690DD4]/[0.07] to-[#E0F840]/[0.05]",
          pitchAccentBar: "bg-[#690DD4]/50",
          iconBg: "bg-[#690DD4]/15 text-[#690DD4]",
        };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#690DD4]/12 blur-3xl" />
        <div className="absolute top-1/3 right-[-120px] h-[380px] w-[380px] rounded-full bg-[#E0F840]/10 blur-3xl" />
        <div className="absolute bottom-0 left-[-100px] h-[320px] w-[320px] rounded-full bg-[#E0F840]/6 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 pb-12 sm:px-6 sm:py-12 md:py-16">
        <div className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/80 px-4 py-3.5 shadow-sm backdrop-blur-md sm:mb-10 sm:px-5">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <BrandLogo className="h-7 shrink-0 sm:h-8" />
          </Link>
          <Link
            href="/"
            className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("notFound.backHome")}
          </Link>
        </div>

        <Card
          className={cn(
            "overflow-hidden rounded-2xl border-border/70 bg-card/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:rounded-3xl",
            variant === "client" &&
              "ring-1 ring-[#E0F840]/15 dark:shadow-[0_24px_80px_rgba(0,0,0,0.5)]",
            variant === "provider" &&
              "ring-1 ring-[#690DD4]/15 dark:shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
          )}
        >
          <div
            className={cn(
              "h-1 w-full bg-gradient-to-r from-transparent to-transparent",
              variant === "client" && "via-[#E0F840]/70",
              variant === "provider" && "via-[#690DD4]/70"
            )}
          />
          <CardHeader className="space-y-4 px-5 pb-2 pt-8 sm:px-8 sm:pt-10">
            <div>
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {t(`${prefix}.title`)}
              </CardTitle>
              <CardDescription className="mt-2 text-base leading-relaxed text-muted-foreground">
                {t(`${prefix}.subtitle`)}
              </CardDescription>
            </div>

            <div
              className={cn(
                "rounded-xl border bg-gradient-to-br p-4 sm:p-5",
                accent.pitchBorder,
                accent.pitchBg
              )}
            >
              <div className={cn("mb-3 h-1 w-10 rounded-full", accent.pitchAccentBar)} />
              <p className="text-sm font-semibold text-foreground sm:text-base">
                {t(`${prefix}.pitchTitle`)}
              </p>
              <ul className="mt-3 space-y-2.5">
                {([0, 1, 2] as const).map((i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                        accent.iconBg
                      )}
                    >
                      <Check className="h-3 w-3 stroke-[2.5]" aria-hidden />
                    </span>
                    <span>{t(`${prefix}.pitchBullet${i}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardHeader>

          <CardContent className="px-5 pb-8 pt-2 sm:px-8 sm:pb-10">
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-6 md:gap-y-5">
                <div className="space-y-2 md:min-w-0">
                  <Label htmlFor="fullName" className="text-sm font-medium">
                    {t("forms.fields.fullName")}
                    <span className="ms-1 text-destructive" aria-hidden>
                      *
                    </span>
                  </Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    required
                    minLength={2}
                    maxLength={100}
                    className={fieldClass}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2 md:min-w-0">
                  <Label htmlFor="email" className="text-sm font-medium">
                    {t("forms.fields.email")}
                    <span className="ms-1 text-destructive" aria-hidden>
                      *
                    </span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    className={fieldClass}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2 md:min-w-0">
                  <Label htmlFor="whatsapp" className="text-sm font-medium">
                    {t("forms.fields.whatsapp")}
                    <span className="ms-1 text-destructive" aria-hidden>
                      *
                    </span>
                  </Label>
                  <Input
                    id="whatsapp"
                    name="whatsapp"
                    required
                    maxLength={50}
                    className={fieldClass}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
                <div className="space-y-2 md:min-w-0">
                  <Label htmlFor="company" className="text-sm font-medium">
                    {t("forms.fields.company")}
                  </Label>
                  <Input
                    id="company"
                    name="company"
                    maxLength={120}
                    className={fieldClass}
                    autoComplete="organization"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="website" className="text-sm font-medium">
                    {t("forms.fields.website")}
                  </Label>
                  <Input
                    id="website"
                    name="website"
                    maxLength={300}
                    className={fieldClass}
                    placeholder={
                      variant === "client" ? "https://…" : "Portfolio / LinkedIn / social links"
                    }
                  />
                </div>
              </div>

              {variant === "provider" && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("forms.provider.servicesLabel")}
                      <span className="ms-1 text-muted-foreground font-normal">
                        ({t("forms.provider.servicesOptional")})
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("forms.provider.servicesHint")}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {PROVIDER_FORM_SERVICE_IDS.map((id) => (
                      <label
                        key={id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-background/50 px-3 py-2.5 text-sm shadow-sm transition-colors hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          name="services"
                          value={id}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-primary text-primary accent-primary"
                        />
                        <span className="leading-snug text-foreground">{tSvc(id)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-medium">
                  {t("forms.fields.message")}
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  minLength={10}
                  maxLength={4000}
                  className={textareaClass}
                  rows={6}
                />
              </div>

              <div className="border-t border-border/60 pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  variant={variant === "client" ? "default" : "outline"}
                  size="lg"
                  className={cn(
                    "w-full rounded-xl text-base font-semibold shadow-lg transition-all",
                    variant === "client" &&
                      "h-12 bg-[#690DD4] text-[#E0F840] shadow-[0_8px_28px_rgba(105,13,212,0.28)] hover:opacity-95 hover:shadow-[0_12px_36px_rgba(224,248,64,0.22)] sm:h-11",
                    variant === "provider" &&
                      "h-12 border-2 border-border/80 bg-background/90 text-foreground backdrop-blur-sm hover:border-[#690DD4]/45 hover:bg-muted/60 sm:h-11"
                  )}
                >
                  {loading ? t("forms.actions.sending") : t("forms.actions.send")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
