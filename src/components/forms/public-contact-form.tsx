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
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";
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
  const tCommon = useTranslations("common");

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
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-0 end-[-80px] h-[320px] w-[320px] rounded-full bg-[#E0F840]/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 pb-16 sm:px-6 sm:py-12">
        <header className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/70 px-4 py-3.5 shadow-sm backdrop-blur-md sm:mb-10 sm:px-5">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <BrandLogo className="h-7 shrink-0 sm:h-8" />
          </Link>
          <Link
            href="/"
            className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {tCommon("buttons.backHome")}
          </Link>
        </header>

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

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        {tFields("phone")}
                        <span className="ms-1 text-destructive" aria-hidden>
                          *
                        </span>
                      </Label>
                      <div className="flex gap-2 rtl:flex-row-reverse">
                        <Select
                          value={countryCode}
                          onValueChange={setCountryCode}
                          disabled={loading}
                        >
                          <SelectTrigger className="h-12 w-[110px] rounded-xl">
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
                          required
                          inputMode="tel"
                          autoComplete="tel"
                          disabled={loading}
                          className={cn(fieldClass, "flex-1")}
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value.replaceAll(/\D/g, ""))}
                          pattern="\d{7,15}"
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
                    className="h-12 w-full gap-2 rounded-xl text-sm font-semibold sm:w-auto sm:min-w-[180px]"
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
