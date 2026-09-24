"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";

const fieldClass =
  "h-12 rounded-xl border-border/70 bg-background/70 shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-[#690DD4]/50 focus-visible:ring-2 focus-visible:ring-[#690DD4]/25";

const textareaClass =
  "min-h-[148px] resize-y rounded-xl border-border/70 bg-background/70 shadow-sm transition-all focus-visible:border-[#690DD4]/50 focus-visible:ring-2 focus-visible:ring-[#690DD4]/25";

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

export function ContactFormPage() {
  const t = useTranslations();
  const tSvc = useTranslations("forms.provider.serviceOptions");
  const [loading, setLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Set<ProviderFormServiceId>>(
    () => new Set()
  );
  const submitLockRef = useRef(false);

  function toggleService(id: ProviderFormServiceId) {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    const serviceIds = Array.from(selectedServices);
    const payload = {
      type: "provider" as const,
      fullName: getText("fullName"),
      email: getText("email"),
      phone: getText("phone"),
      company: getText("company"),
      website: getText("website"),
      message: getText("message"),
      services: serviceIds,
    };

    try {
      const serviceLabelsForEmail =
        payload.services.length > 0
          ? payload.services.map((id) => tSvc(id)).join(", ")
          : "—";

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
        setSelectedServices(new Set());
        toast.success(t("forms.toast.sentTitle"), { description: t("forms.toast.sentDesc") });
        return;
      }

      toast.error(t("forms.toast.errorTitle"), { description: t("forms.toast.errorDesc") });
    } catch {
      toast.error(t("forms.toast.errorTitle"), { description: t("forms.toast.errorDesc") });
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[#690DD4]/16 blur-3xl" />
        <div className="absolute top-1/4 right-[-140px] h-[420px] w-[420px] rounded-full bg-[#E0F840]/12 blur-3xl" />
        <div className="absolute bottom-0 left-[-120px] h-[360px] w-[360px] rounded-full bg-[#690DD4]/8 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 pb-16 sm:px-6 sm:py-12 md:py-16">
        <div className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/70 px-4 py-3.5 shadow-sm backdrop-blur-md sm:mb-10 sm:px-5">
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

        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-sm ring-1 ring-[#690DD4]/12">
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#690DD4]/80 to-[#E0F840]/55" />

          <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
            {/* Pitch panel */}
            <aside className="relative border-b border-border/60 bg-gradient-to-br from-[#690DD4]/[0.12] via-muted/20 to-[#E0F840]/[0.06] px-6 py-8 sm:px-8 sm:py-10 lg:border-b-0 lg:border-e lg:border-border/60">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(105,13,212,0.18),transparent_55%)]"
                aria-hidden
              />
              <div className="relative">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#690DD4]/25 bg-[#690DD4]/10 px-3 py-1 text-xs font-medium text-foreground/90">
                  <Sparkles className="h-3.5 w-3.5 text-[#690DD4]" aria-hidden />
                  {t("forms.provider.badge")}
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {t("forms.provider.title")}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {t("forms.provider.subtitle")}
                </p>

                <div className="mt-8 space-y-4">
                  <p className="text-sm font-semibold text-foreground">
                    {t("forms.provider.pitchTitle")}
                  </p>
                  <ul className="space-y-3.5">
                    {([0, 1, 2] as const).map((i) => (
                      <li
                        key={i}
                        className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#690DD4]/15 text-[#690DD4] ring-1 ring-[#690DD4]/20">
                          <Check className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden />
                        </span>
                        <span>{t(`forms.provider.pitchBullet${i}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </aside>

            {/* Form panel */}
            <div className="px-5 py-8 sm:px-8 sm:py-10">
              <form onSubmit={onSubmit} className="space-y-7">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-5 md:gap-y-5">
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
                      className={fieldClass}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2 md:min-w-0">
                    <Label htmlFor="phone" className="text-sm font-medium">
                      {t("forms.fields.phone")}
                      <span className="ms-1 text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
                    <Input
                      id="phone"
                      name="phone"
                      required
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
                      className={fieldClass}
                      placeholder={t("forms.provider.websitePlaceholder")}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("forms.provider.servicesLabel")}
                      <span className="ms-1 font-normal text-muted-foreground">
                        ({t("forms.provider.servicesOptional")})
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("forms.provider.servicesHint")}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {PROVIDER_FORM_SERVICE_IDS.map((id) => {
                      const selected = selectedServices.has(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleService(id)}
                          aria-pressed={selected}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-start text-sm shadow-sm transition-all",
                            selected
                              ? "border-[#690DD4]/45 bg-[#690DD4]/10 shadow-[0_0_0_1px_rgba(105,13,212,0.12)]"
                              : "border-border/70 bg-background/50 hover:border-border hover:bg-muted/40"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                              selected
                                ? "border-[#690DD4] bg-[#690DD4] text-[#E0F840]"
                                : "border-muted-foreground/40 bg-background"
                            )}
                            aria-hidden
                          >
                            {selected ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : null}
                          </span>
                          <span className="leading-snug text-foreground">{tSvc(id)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-sm font-medium">
                    {t("forms.fields.message")}
                  </Label>
                  <Textarea
                    id="message"
                    name="message"
                    className={textareaClass}
                    rows={6}
                    placeholder={t("forms.provider.messagePlaceholder")}
                  />
                </div>

                <div className="border-t border-border/60 pt-5">
                  <Button
                    type="submit"
                    disabled={loading}
                    size="lg"
                    className="h-12 w-full rounded-xl bg-[#690DD4] text-base font-semibold text-[#E0F840] shadow-[0_10px_32px_rgba(105,13,212,0.32)] transition-all hover:-translate-y-0.5 hover:opacity-95 hover:shadow-[0_14px_40px_rgba(105,13,212,0.4)] sm:h-11"
                  >
                    {loading ? t("forms.actions.sending") : t("forms.actions.send")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
