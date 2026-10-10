"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, FileText, Loader2, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PhoneCountrySelect } from "@/components/forms/phone-country-select";
import { LandingHeader } from "@/components/landing/landing-header";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { emailSchema, passwordSchema, phoneNumberOnlySchema } from "@/lib/validations";
import {
  isAllowedProviderCvMime,
  PROVIDER_CV_ACCEPT_ATTR,
  PROVIDER_CV_MAX_BYTES,
  PROVIDER_CV_MAX_MB,
} from "@/lib/upload-limits";

const fieldClass =
  "h-12 rounded-xl border-border/70 bg-background/70 shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-[#690DD4]/50 focus-visible:ring-2 focus-visible:ring-[#690DD4]/25";

const textareaClass =
  "min-h-[148px] resize-y rounded-xl border-border/70 bg-background/70 shadow-sm transition-all focus-visible:border-[#690DD4]/50 focus-visible:ring-2 focus-visible:ring-[#690DD4]/25";

type PublicService = {
  id: string;
  name: string;
  nameI18n?: Record<string, string> | null;
};

function serviceLabel(service: PublicService, locale: string) {
  return service.nameI18n?.[locale] || service.name;
}

export function ContactFormPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(() => new Set());
  const [countryCode, setCountryCode] = useState("+20");
  const [phoneInput, setPhoneInput] = useState("");
  const [cvFile, setCvFile] = useState<{ url: string; filename: string } | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const submitLockRef = useRef(false);

  const { data: catalogServices, isLoading: servicesLoading } =
    trpc.admin.getPublicServiceTypes.useQuery(undefined, {
      staleTime: 1000 * 60 * 5,
    });
  const registerProvider = trpc.auth.registerProvider.useMutation();

  function toggleService(id: string) {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function uploadCv(file: File) {
    if (!isAllowedProviderCvMime(file.type, file.name)) {
      toast.error(t("forms.toast.errorTitle"), {
        description: t("forms.provider.cvInvalidType"),
      });
      return;
    }
    if (file.size <= 0 || file.size > PROVIDER_CV_MAX_BYTES) {
      toast.error(t("forms.toast.errorTitle"), {
        description: t("forms.provider.cvTooLarge", { maxSize: PROVIDER_CV_MAX_MB }),
      });
      return;
    }

    setCvUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload/provider-cv", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
        filename?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error || t("forms.provider.cvUploadFailed"));
      }
      setCvFile({ url: data.url, filename: data.filename || file.name });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("forms.provider.cvUploadFailed");
      toast.error(t("forms.toast.errorTitle"), { description: msg });
      setCvFile(null);
    } finally {
      setCvUploading(false);
      if (cvInputRef.current) cvInputRef.current.value = "";
    }
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

    const name = getText("fullName");
    const email = getText("email").toLowerCase();
    const password = getText("password");
    const confirmPassword = getText("confirmPassword");
    const website = getText("website");
    const message = getText("message");
    const serviceIds = Array.from(selectedServices);

    try {
      const emailValidation = emailSchema.safeParse(email);
      if (!emailValidation.success) {
        toast.error(t("forms.toast.errorTitle"), {
          description: emailValidation.error.errors[0]?.message || t("forms.toast.errorDesc"),
        });
        return;
      }

      const phoneValidation = phoneNumberOnlySchema.safeParse(phoneInput);
      if (!phoneValidation.success || !phoneInput) {
        toast.error(t("forms.toast.errorTitle"), {
          description: t("forms.fields.phoneInvalid"),
        });
        return;
      }

      if (password !== confirmPassword) {
        toast.error(t("forms.toast.errorTitle"), {
          description: t("forms.fields.passwordsNotMatch"),
        });
        return;
      }

      const passwordValidation = passwordSchema.safeParse(password);
      if (!passwordValidation.success) {
        toast.error(t("forms.toast.errorTitle"), {
          description:
            passwordValidation.error.errors[0]?.message || t("forms.fields.passwordTooShort"),
        });
        return;
      }

      if (serviceIds.length === 0) {
        toast.error(t("forms.toast.errorTitle"), {
          description: t("forms.provider.servicesRequired"),
        });
        return;
      }

      const result = await registerProvider.mutateAsync({
        name,
        email,
        password: passwordValidation.data,
        confirmPassword: passwordValidation.data,
        phone: `${countryCode} ${phoneInput}`,
        website,
        message,
        cvUrl: cvFile?.url ?? "",
        serviceIds,
      });

      formEl.reset();
      setSelectedServices(new Set());
      setPhoneInput("");
      setCountryCode("+20");
      setCvFile(null);
      toast.success(
        result.reapplied ? t("forms.toast.reapplyTitle") : t("forms.toast.pendingTitle"),
        {
          description: result.reapplied
            ? t("forms.toast.reapplyDesc")
            : t("forms.toast.pendingDesc"),
        }
      );
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("forms.toast.errorDesc");
      toast.error(t("forms.toast.errorTitle"), { description: msg });
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  const busy = loading || registerProvider.isPending || cvUploading;
  const services = (catalogServices as PublicService[] | undefined) ?? [];

  return (
    <div className="relative min-h-screen bg-background">
      <LandingHeader />

      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[#690DD4]/16 blur-3xl" />
        <div className="absolute top-1/4 right-[-140px] h-[420px] w-[420px] rounded-full bg-[#E0F840]/12 blur-3xl" />
        <div className="absolute bottom-0 left-[-120px] h-[360px] w-[360px] rounded-full bg-[#690DD4]/8 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] pt-[calc(5.75rem+env(safe-area-inset-top,0px))] sm:px-6 sm:pb-16 sm:pt-[calc(7rem+env(safe-area-inset-top,0px))]">
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-sm ring-1 ring-[#690DD4]/12">
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#690DD4]/80 to-[#E0F840]/55" />

          <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
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
                      disabled={busy}
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
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-2 md:min-w-0 md:col-span-2">
                    <Label htmlFor="phone" className="text-sm font-medium">
                      {t("forms.fields.phone")}
                      <span className="ms-1 text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
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
                        required
                        className={cn(fieldClass, "min-w-0 flex-1 text-base tabular-nums")}
                        autoComplete="tel"
                        inputMode="tel"
                        value={phoneInput}
                        onChange={(e) => {
                          setPhoneInput(e.target.value.replaceAll(/\D/g, ""));
                        }}
                        pattern="\d{7,15}"
                        disabled={busy}
                        placeholder={t("forms.fields.phonePlaceholder")}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:min-w-0">
                    <Label htmlFor="password" className="text-sm font-medium">
                      {t("forms.fields.password")}
                      <span className="ms-1 text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
                    <PasswordInput
                      id="password"
                      name="password"
                      required
                      className={fieldClass}
                      autoComplete="new-password"
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-2 md:min-w-0">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">
                      {t("forms.fields.confirmPassword")}
                      <span className="ms-1 text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
                    <PasswordInput
                      id="confirmPassword"
                      name="confirmPassword"
                      required
                      className={fieldClass}
                      autoComplete="new-password"
                      disabled={busy}
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
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("forms.provider.servicesLabel")}
                      <span className="ms-1 text-destructive" aria-hidden>
                        *
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("forms.provider.servicesHint")}
                    </p>
                  </div>
                  {servicesLoading ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("forms.provider.servicesLoading")}
                    </div>
                  ) : services.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("forms.provider.servicesEmpty")}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {services.map((service) => {
                        const selected = selectedServices.has(service.id);
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => toggleService(service.id)}
                            aria-pressed={selected}
                            disabled={busy}
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
                            <span className="leading-snug text-foreground">
                              {serviceLabel(service, locale)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
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
                    disabled={busy}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cv" className="text-sm font-medium">
                    {t("forms.provider.cvLabel")}
                    <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                      ({t("forms.provider.cvOptional")})
                    </span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("forms.provider.cvHint", { maxSize: PROVIDER_CV_MAX_MB })}
                  </p>
                  <input
                    ref={cvInputRef}
                    id="cv"
                    name="cv"
                    type="file"
                    accept={PROVIDER_CV_ACCEPT_ATTR}
                    className="sr-only"
                    disabled={busy || cvUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadCv(file);
                    }}
                  />
                  {cvFile ? (
                    <div className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-border/70 bg-background/70 px-4 py-5">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-start transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        disabled={busy || cvUploading}
                        onClick={() => cvInputRef.current?.click()}
                        aria-label={t("forms.provider.cvChoose")}
                      >
                        <FileText className="h-5 w-5 shrink-0 text-[#690DD4]" />
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                          {cvFile.filename}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={busy || cvUploading}
                        onClick={() => setCvFile(null)}
                        aria-label={t("forms.provider.cvRemove")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 px-4 py-8 text-center transition-colors hover:border-primary/55 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={busy || cvUploading}
                      onClick={() => cvInputRef.current?.click()}
                    >
                      {cvUploading ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {t("forms.provider.cvUploading")}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <FileText className="h-6 w-6" />
                          </span>
                          <span className="text-sm font-semibold text-primary">
                            {t("forms.provider.cvChoose")}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="border-t border-border/60 pt-5">
                  <Button
                    type="submit"
                    disabled={busy || servicesLoading || services.length === 0}
                    size="lg"
                    className="h-12 w-full rounded-xl bg-[#690DD4] text-base font-semibold text-[#E0F840] shadow-[0_10px_32px_rgba(105,13,212,0.32)] transition-all hover:-translate-y-0.5 hover:opacity-95 hover:shadow-[0_14px_40px_rgba(105,13,212,0.4)] sm:h-11"
                  >
                    {busy ? t("forms.actions.sending") : t("forms.actions.submitApplication")}
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
