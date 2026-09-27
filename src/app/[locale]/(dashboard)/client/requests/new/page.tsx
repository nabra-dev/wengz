"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n";
import {
  clearPendingRequestDescription,
  getPendingRequestDescription,
} from "@/lib/landing-request-draft";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { ServiceAttributesForm } from "@/components/client/service-attributes-form";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";
import { ArrowLeft } from "lucide-react";
import type { AttributeResponse, ServiceAttribute } from "@/types/service-attributes";
import { calculateAttributeCredits } from "@/lib/attribute-validation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FieldKey = "serviceType" | "title" | "description";

function isAttrAnswerEmpty(answer: string | string[] | undefined): boolean {
  if (answer === undefined || answer === null) return true;
  if (typeof answer === "string") return answer.trim() === "";
  return answer.length === 0;
}

export default function NewRequestPage() {
  const t = useTranslations("client.newRequest");
  const router = useRouter();
  const [selectedServiceType, setSelectedServiceType] = useState("");
  const [priority] = useState("1");
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [attributeResponses, setAttributeResponses] = useState<AttributeResponse[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState<Partial<Record<FieldKey | string, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const { data: serviceTypes } = trpc.request.getServiceTypes.useQuery();
  const locale = useLocale();
  const utils = trpc.useUtils();
  const {
    data: subscription,
    isFetched: subscriptionFetched,
    isLoading: subscriptionLoading,
  } = trpc.subscription.getActive.useQuery(undefined, {
    refetchOnMount: "always",
    staleTime: 0,
  });

  useEffect(() => {
    const draft = getPendingRequestDescription();
    if (!draft?.trim()) return;
    queueMicrotask(() => {
      setDescription(draft);
      const firstLine = draft.split("\n")[0]?.trim() ?? "";
      let nextTitle = firstLine || draft.trim();
      if (!nextTitle) {
        nextTitle = t("draftTitleFallback");
      }
      setTitle(nextTitle);
      clearPendingRequestDescription();
      toast.success(t("draftRestored"));
    });
  }, [t]);

  const selectedService = useMemo(
    () => serviceTypes?.find((s: { id: string }) => s.id === selectedServiceType),
    [serviceTypes, selectedServiceType]
  );

  // Reset attribute responses when service type changes
  useEffect(() => {
    queueMicrotask(() => {
      setAttributeResponses([]);
      setTouched((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.startsWith("attr:")) delete next[key];
        }
        return next;
      });
    });
  }, [selectedServiceType]);

  const createRequest = trpc.request.create.useMutation({
    onSuccess: (data) => {
      void utils.subscription.getActive.invalidate();
      toast.success(t("toast.created"), {
        description: t("toast.createdDesc"),
      });
      router.push(`/client/requests/${data.request.id}`);
    },
    onError: (err: unknown) => {
      showError(err, "Failed to create request");
    },
  });

  const hasCredits = Boolean(subscription && subscription.remainingCredits > 0);
  const showNoSubscription = subscriptionFetched && !subscriptionLoading && !subscription;
  const baseCreditCost = (selectedService as { creditCost?: number })?.creditCost || 1;

  // Calculate attribute credits dynamically
  const attributeCredits = useMemo(() => {
    if (!selectedService || !attributeResponses.length) return 0;
    const attributes = (selectedService as any).attributes as ServiceAttribute[] | undefined;
    if (!attributes) return 0;
    return calculateAttributeCredits(attributes, attributeResponses);
  }, [selectedService, attributeResponses]);

  // Priority costs from the selected service type
  const lowCost = (selectedService as { priorityCostLow?: number })?.priorityCostLow ?? 0;
  const mediumCost = (selectedService as { priorityCostMedium?: number })?.priorityCostMedium ?? 1;
  const highCost = (selectedService as { priorityCostHigh?: number })?.priorityCostHigh ?? 2;

  const priorityCostsMap: Record<string, number> = { "1": lowCost, "2": mediumCost, "3": highCost };
  const priorityCost = priorityCostsMap[priority] ?? lowCost;
  const totalCreditCost = baseCreditCost + attributeCredits + priorityCost;

  const canAffordService = Boolean(
    subscription && subscription.remainingCredits >= totalCreditCost
  );
  const showInsufficientCredits =
    subscriptionFetched &&
    Boolean(subscription) &&
    (!hasCredits || (Boolean(selectedServiceType) && !canAffordService));

  let buttonText = t("actions.create", { cost: 1 });
  if (createRequest.isPending) {
    buttonText = t("actions.creating");
  } else if (totalCreditCost !== 1) {
    buttonText = t("actions.createCredits", { cost: totalCreditCost });
  }

  const markTouched = useCallback((key: string) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const getTitleError = useCallback(
    (value: string): string | null => {
      if (!value.trim()) return t("validation.requiredField");
      return null;
    },
    [t]
  );

  const getDescriptionError = useCallback(
    (value: string): string | null => {
      if (!value.trim()) return t("validation.requiredField");
      return null;
    },
    [t]
  );

  const getServiceError = useCallback(
    (value: string): string | null => {
      if (!value) return t("validation.selectService");
      return null;
    },
    [t]
  );

  const getAttributeErrors = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    const attributes = ((selectedService as any)?.attributes || []) as ServiceAttribute[];
    for (const attr of attributes) {
      if (!attr.required) continue;
      const response = attributeResponses.find((r) => r.question === attr.question);
      if (isAttrAnswerEmpty(response?.answer)) {
        const label = resolveLocalizedText((attr as any).questionI18n, locale, attr.question);
        errors[attr.question] = t("validation.requiredAttribute", { field: label });
      }
    }
    return errors;
  }, [selectedService, attributeResponses, locale, t]);

  const showFieldError = (key: string) => submitAttempted || !!touched[key];

  const serviceError = showFieldError("serviceType") ? getServiceError(selectedServiceType) : null;
  const titleError = showFieldError("title") ? getTitleError(title) : null;
  const descriptionError = showFieldError("description") ? getDescriptionError(description) : null;
  const attributeErrors = getAttributeErrors();
  const visibleAttributeErrors = Object.fromEntries(
    Object.entries(attributeErrors).filter(
      ([question]) => submitAttempted || touched[`attr:${question}`]
    )
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitAttempted(true);

    const formData = new FormData(e.currentTarget);
    const formPriority = Number.parseInt(formData.get("priority") as string) || 1;

    const nextServiceError = getServiceError(selectedServiceType);
    const nextTitleError = getTitleError(title);
    const nextDescriptionError = getDescriptionError(description);
    const nextAttrErrors = getAttributeErrors();

    if (
      nextServiceError ||
      nextTitleError ||
      nextDescriptionError ||
      Object.keys(nextAttrErrors).length > 0
    ) {
      toast.error(t("toast.validationError"), {
        description: t("validation.fixErrors"),
      });
      return;
    }

    createRequest.mutate({
      title: title.trim(),
      description: description.trim(),
      serviceTypeId: selectedServiceType,
      priority: formPriority,
      attachments: attachments.map((f) => f.url),
      attributeResponses: attributeResponses.length > 0 ? attributeResponses : undefined,
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button asChild variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0">
          <Link href="/client/requests" aria-label={t("actions.cancel")}>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {showInsufficientCredits && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40">
          <CardHeader>
            <CardTitle className="text-orange-800 dark:text-orange-200">
              {t("insufficientCredits.title")}
            </CardTitle>
            <CardDescription className="text-orange-700 dark:text-orange-300">
              {selectedServiceType
                ? t(
                    priorityCost > 0
                      ? "insufficientCredits.description"
                      : "insufficientCredits.descriptionNoPriority",
                    {
                      required: totalCreditCost,
                      credit: totalCreditCost === 1 ? t("credit") : t("credits"),
                      baseCost: baseCreditCost,
                      priorityCost,
                      available: subscription?.remainingCredits || 0,
                    }
                  )
                : t("insufficientCredits.zeroCredits")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/client/subscription">
              <Button>{t("insufficientCredits.viewPlans")}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {showNoSubscription && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/40">
          <CardHeader>
            <CardTitle className="text-yellow-800 dark:text-yellow-200">
              {t("noSubscription.title")}
            </CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-300">
              {t("noSubscription.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/client/subscription">
              <Button>{t("noSubscription.viewPackages")}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {subscription && serviceTypes?.length === 0 && (
        <Card className="border-border bg-muted/40">
          <CardHeader>
            <CardTitle>{t("noServices.title")}</CardTitle>
            <CardDescription>
              {t("noServices.description", {
                name:
                  (subscription.package as any)?.nameI18n?.[locale] || subscription.package?.name,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/client/subscription">{t("noServices.upgradePackage")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("requestDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div className="space-y-2">
              <Label htmlFor="serviceType" className="flex items-center gap-1">
                {t("fields.serviceType")}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Select
                value={selectedServiceType}
                onValueChange={(value) => {
                  setSelectedServiceType(value);
                  markTouched("serviceType");
                }}
                disabled={!hasCredits}
              >
                <SelectTrigger
                  id="serviceType"
                  aria-invalid={!!serviceError}
                  className={cn(serviceError && "border-destructive focus:ring-destructive")}
                  onBlur={() => markTouched("serviceType")}
                >
                  <SelectValue placeholder={t("fields.serviceTypePlaceholder")} />
                </SelectTrigger>
                <SelectContent className="w-[var(--radix-select-trigger-width)] max-w-[min(100vw-2rem,var(--radix-select-trigger-width))]">
                  {serviceTypes?.map((type: any) => {
                    const creditLabel = type.creditCost === 1 ? t("credit") : t("credits");
                    const supportingPackages = type.supportingPackages || [];
                    const packageName =
                      supportingPackages.length > 0
                        ? resolveLocalizedText(
                            supportingPackages[0].nameI18n,
                            locale,
                            supportingPackages[0].name
                          )
                        : "";
                    const serviceName = resolveLocalizedText(type.nameI18n, locale, type.name);
                    const creditCost = type.creditCost || 1;

                    return (
                      <SelectItem
                        key={type.id}
                        value={type.id}
                        disabled={!type.isSupported}
                        textValue={serviceName}
                        className="h-auto items-start py-2.5"
                      >
                        <span className="flex min-w-0 flex-col gap-1 text-start">
                          <span className="flex min-w-0 items-center gap-2">
                            {type.icon ? (
                              <span className="shrink-0 text-base leading-none" aria-hidden>
                                {type.icon}
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1 truncate font-medium leading-snug">
                              {serviceName}
                            </span>
                            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                              {creditCost}
                              <span className="sr-only"> {creditLabel}</span>
                            </span>
                          </span>
                          {!type.isSupported && packageName ? (
                            <span className="truncate text-[11px] leading-tight text-muted-foreground">
                              {t("supportedFromPackage", { name: packageName })}
                            </span>
                          ) : null}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {serviceError && (
                <p className="text-sm text-destructive" role="alert">
                  {serviceError}
                </p>
              )}
              {selectedService && (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm leading-relaxed text-foreground break-words">
                      {resolveLocalizedText(
                        (selectedService as any).descriptionI18n,
                        locale,
                        selectedService.description ?? undefined
                      )}
                    </p>
                    <span className="shrink-0 rounded-md bg-background px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground border">
                      {(selectedService as { creditCost?: number }).creditCost || 1}{" "}
                      {((selectedService as { creditCost?: number }).creditCost || 1) === 1
                        ? t("credit")
                        : t("credits")}
                    </span>
                  </div>
                  {!selectedService.isSupported &&
                    (selectedService as any).supportingPackages?.length > 0 && (
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 break-words">
                        {t("supportedInPackage", {
                          name: resolveLocalizedText(
                            (selectedService as any).supportingPackages[0].nameI18n,
                            locale,
                            (selectedService as any).supportingPackages[0].name
                          ),
                        })}
                      </p>
                    )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center gap-1">
                {t("fields.title")}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markTouched("title");
                }}
                onBlur={() => markTouched("title")}
                placeholder={t("fields.titlePlaceholder")}
                disabled={!hasCredits || createRequest.isPending}
                aria-invalid={!!titleError}
                className={cn(titleError && "border-destructive focus-visible:ring-destructive")}
              />
              <div className="flex items-center justify-between gap-2">
                {titleError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {titleError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("fields.titleHint")}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="flex items-center gap-1">
                {t("fields.description")}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  markTouched("description");
                }}
                onBlur={() => markTouched("description")}
                placeholder={t("fields.descriptionPlaceholder")}
                disabled={!hasCredits || createRequest.isPending}
                rows={4}
                aria-invalid={!!descriptionError}
                className={cn(
                  descriptionError && "border-destructive focus-visible:ring-destructive"
                )}
              />
              <div className="flex items-center justify-between gap-2">
                {descriptionError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {descriptionError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("fields.descriptionHint")}</p>
                )}
              </div>
            </div>

            {/* <div className="space-y-2">
              <Label htmlFor="priority">{t("fields.priority")}</Label>
              <Select
                name="priority"
                value={priority}
                onValueChange={setPriority}
                disabled={!hasCredits}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("fields.priorityLow", { cost: lowCost })}</SelectItem>
                  <SelectItem value="2">
                    {t("fields.priorityMedium", {
                      cost: mediumCost,
                      credit: mediumCost === 1 ? t("credit") : t("credits"),
                    })}
                  </SelectItem>
                  <SelectItem value="3">{t("fields.priorityHigh", { cost: highCost })}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("fields.priorityHint", { low: lowCost, medium: mediumCost, high: highCost })}
              </p>
            </div> */}

            <div className="space-y-2">
              <Label>{t("fields.attachments")}</Label>
              <FileUpload
                onFilesChange={setAttachments}
                maxFiles={5}
                maxSizeMB={500}
                disabled={!hasCredits || createRequest.isPending}
              />
            </div>

            {/* Dynamic Q&A based on selected service */}
            {selectedService && (selectedService as any).attributes && (
              <ServiceAttributesForm
                attributes={(selectedService as any).attributes}
                responses={attributeResponses}
                onChange={setAttributeResponses}
                disabled={!hasCredits || createRequest.isPending}
                showErrors={submitAttempted}
                fieldErrors={visibleAttributeErrors}
                onFieldBlur={(question) => markTouched(`attr:${question}`)}
                onFieldChange={(question) => markTouched(`attr:${question}`)}
              />
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-4">
              <Button asChild type="button" variant="outline" className="w-full sm:w-auto">
                <Link href="/client/requests">{t("actions.cancel")}</Link>
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={!canAffordService || createRequest.isPending}
              >
                {buttonText}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Sticky cost summary */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:static lg:z-auto lg:rounded-lg lg:border lg:bg-card lg:backdrop-blur-none lg:supports-[backdrop-filter]:bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-4 lg:py-3 lg:pb-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs text-muted-foreground">{t("costSummary.total")}</p>
            <p className="text-base font-semibold tabular-nums">
              {selectedServiceType ? totalCreditCost : "—"}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {totalCreditCost === 1 ? t("credit") : t("credits")}
              </span>
            </p>
          </div>
          <div className="text-end space-y-0.5 shrink-0">
            <p className="text-xs text-muted-foreground">{t("costSummary.available")}</p>
            <p className="text-sm font-medium tabular-nums">
              {subscription?.remainingCredits ?? 0}
            </p>
          </div>
          {selectedServiceType && subscription && (
            <div className="hidden sm:block text-end space-y-0.5 shrink-0">
              <p className="text-xs text-muted-foreground">{t("costSummary.remaining")}</p>
              <p
                className={`text-sm font-medium tabular-nums ${
                  canAffordService ? "" : "text-destructive"
                }`}
              >
                {Math.max(0, (subscription.remainingCredits || 0) - totalCreditCost)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
