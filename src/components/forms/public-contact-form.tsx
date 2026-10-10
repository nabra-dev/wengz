"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2, Mail, MessageSquare, Send } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneCountrySelect } from "@/components/forms/phone-country-select";
import { LandingHeader } from "@/components/landing/landing-header";
import { WHATSAPP_DISPLAY, WHATSAPP_HREF } from "@/components/marketing/floating-whatsapp";
import { cn } from "@/lib/utils";
import { emailSchema, phoneNumberOnlySchema } from "@/lib/validations";

const fieldClass =
  "h-12 rounded-xl border-border/70 bg-background/80 shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20";

const textareaClass =
  "min-h-[140px] resize-y rounded-xl border-border/70 bg-background/80 shadow-sm transition-all focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20";

const TOPICS = ["general", "support", "partnership", "billing"] as const;
type Topic = (typeof TOPICS)[number];

export function PublicContactForm() {
  const t = useTranslations("forms.contact");
  const tFields = useTranslations("forms.fields");
  const tToast = useTranslations("forms.toast");
  const tActions = useTranslations("forms.actions");

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [topic, setTopic] = useState<Topic>("general");
  const [countryCode, setCountryCode] = useState("+20");
  const [phoneInput, setPhoneInput] = useState("");
  const submitLockRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

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

    const fullName = getText("fullName");
    const email = getText("email").toLowerCase();
    const message = getText("message");

    try {
      const emailValidation = emailSchema.safeParse(email);
      if (!emailValidation.success) {
        toast.error(tToast("errorTitle"), {
          description: emailValidation.error.errors[0]?.message || tToast("errorDesc"),
        });
        return;
      }

      const phoneValidation = phoneNumberOnlySchema.safeParse(phoneInput);
      if (!phoneValidation.success || !phoneInput) {
        toast.error(tToast("errorTitle"), {
          description: tFields("phoneInvalid"),
        });
        return;
      }

      if (message.length < 10) {
        toast.error(tToast("errorTitle"), {
          description: t("messageTooShort"),
        });
        return;
      }

      const res = await fetch("/api/forms/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "general",
          topic: t(`topics.${topic}`),
          fullName,
          email,
          phone: `${countryCode} ${phoneInput}`,
          company: "",
          website: "",
          message,
          serviceLabels: "",
        }),
      });

      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!res.ok || !data?.ok) {
        toast.error(tToast("errorTitle"), {
          description: data?.error || tToast("errorDesc"),
        });
        return;
      }

      setSent(true);
      formEl.reset();
      setPhoneInput("");
      setCountryCode("+20");
      setTopic("general");
      toast.success(tToast("sentTitle"), { description: tToast("sentDesc") });
    } catch {
      toast.error(tToast("errorTitle"), { description: tToast("errorDesc") });
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  function resetForm() {
    setSent(false);
    formRef.current?.reset();
  }

  return (
    <div className="relative min-h-screen bg-background">
      <LandingHeader />

      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-0 end-[-80px] h-[320px] w-[320px] rounded-full bg-[#E0F840]/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] pt-[calc(5.75rem+env(safe-area-inset-top,0px))] sm:px-6 sm:pb-16 sm:pt-[calc(7rem+env(safe-area-inset-top,0px))]">
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-xl ring-1 ring-primary/10">
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/70 to-[#E0F840]/50" />

          <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
            <aside className="relative border-b border-border/60 bg-gradient-to-br from-primary/[0.08] via-muted/15 to-transparent px-6 py-8 sm:px-8 sm:py-10 lg:border-b-0 lg:border-e">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium">
                <MessageSquare className="h-3.5 w-3.5 text-primary" aria-hidden />
                {t("badge")}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("subtitle")}
              </p>

              <div className="mt-8 space-y-4">
                <a
                  href="mailto:info@wengz.tech"
                  className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-background/50 p-4 transition-colors hover:border-primary/30 hover:bg-background/80"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Mail className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t("emailLabel")}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground group-hover:text-foreground">
                      info@wengz.tech
                    </span>
                  </span>
                </a>

                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-background/50 p-4 transition-colors hover:border-[#25D366]/40 hover:bg-background/80"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#1ebe57]">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
                      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.59 2 2.15 6.44 2.15 11.89c0 1.75.46 3.45 1.32 4.95L2.05 22l5.3-1.39a9.84 9.84 0 0 0 4.69 1.19h.01c5.45 0 9.89-4.44 9.89-9.89 0-2.64-1.03-5.12-2.89-6.99Zm-7.01 15.22h-.01a8.17 8.17 0 0 1-4.16-1.14l-.3-.18-3.14.82.84-3.06-.2-.31a8.16 8.16 0 0 1-1.26-4.37c0-4.52 3.68-8.2 8.21-8.2 2.19 0 4.25.86 5.8 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.18 8.2Zm4.49-6.13c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.12-.16.25-.63.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.74 2.66 4.22 3.73.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.17.21-.58.21-1.07.14-1.17-.06-.11-.23-.18-.48-.3Z" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t("whatsappLabel")}</span>
                    <span
                      className="mt-0.5 block truncate text-sm tabular-nums text-muted-foreground group-hover:text-foreground"
                      dir="ltr"
                    >
                      {WHATSAPP_DISPLAY}
                    </span>
                  </span>
                </a>

                <p className="text-xs text-muted-foreground">{t("responseTime")}</p>

                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("quickLinks")}
                  </p>
                  <Link
                    href="/auth/register"
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/60"
                  >
                    {t("ctaRegister")}
                    <ArrowRight className="h-4 w-4 opacity-50 rtl:rotate-180" aria-hidden />
                  </Link>
                  <Link
                    href="/forms/provider"
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/60"
                  >
                    {t("ctaProvider")}
                    <ArrowRight className="h-4 w-4 opacity-50 rtl:rotate-180" aria-hidden />
                  </Link>
                </div>
              </div>
            </aside>

            <div className="px-5 py-8 sm:px-8 sm:py-10">
              {sent ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CheckCircle2 className="h-7 w-7" aria-hidden />
                  </span>
                  <h2 className="text-xl font-semibold tracking-tight">{t("successTitle")}</h2>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("successDesc")}</p>
                  <Button type="button" variant="outline" className="mt-6" onClick={resetForm}>
                    {t("sendAnother")}
                  </Button>
                </div>
              ) : (
                <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">
                        {tFields("fullName")}
                        <span className="ms-1 text-destructive" aria-hidden>
                          *
                        </span>
                      </Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        required
                        autoComplete="name"
                        disabled={loading}
                        className={fieldClass}
                        placeholder={t("namePlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        {tFields("email")}
                        <span className="ms-1 text-destructive" aria-hidden>
                          *
                        </span>
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        disabled={loading}
                        className={fieldClass}
                        placeholder={t("emailPlaceholder")}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      {tFields("phone")}
                      <span className="ms-1 text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
                    <div className="flex gap-2.5 rtl:flex-row-reverse">
                      <PhoneCountrySelect
                        value={countryCode}
                        onValueChange={setCountryCode}
                        disabled={loading}
                      />
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        required
                        inputMode="tel"
                        autoComplete="tel"
                        disabled={loading}
                        className={cn(fieldClass, "min-w-0 flex-1 text-base tabular-nums")}
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value.replaceAll(/\D/g, ""))}
                        pattern="\d{7,15}"
                        placeholder={tFields("phonePlaceholder")}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="topic">{t("topicLabel")}</Label>
                    <Select
                      value={topic}
                      onValueChange={(v) => setTopic(v as Topic)}
                      disabled={loading}
                    >
                      <SelectTrigger id="topic" className={cn(fieldClass, "w-full")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TOPICS.map((key) => (
                          <SelectItem key={key} value={key}>
                            {t(`topics.${key}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">
                      {tFields("message")}
                      <span className="ms-1 text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
                    <Textarea
                      id="message"
                      name="message"
                      required
                      disabled={loading}
                      className={textareaClass}
                      placeholder={t("messagePlaceholder")}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full gap-2 rounded-xl text-sm font-semibold"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {tActions("sending")}
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" aria-hidden />
                        {tActions("send")}
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
