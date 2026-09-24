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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/client/requests">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
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
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800">{t("noServices.title")}</CardTitle>
            <CardDescription className="text-blue-700">
              {t("noServices.description", {
                name:
                  (subscription.package as any)?.nameI18n?.[locale] || subscription.package?.name,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/client/subscription">
              <Button>{t("noServices.upgradePackage")}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("requestDetails")}</CardTitle>
          <CardDescription>
            {selectedServiceType
              ? (() => {
                  const hasAttributes = attributeCredits > 0;
                  const hasPriority = priorityCost > 0;

                  if (hasAttributes && hasPriority) {
                    return t("costInfoWithAttributes", {
                      baseCost: baseCreditCost,
                      credit: baseCreditCost === 1 ? t("credit") : t("credits"),
                      attributeCost: attributeCredits,
                      priorityCost,
                      totalCost: totalCreditCost,
                      available: subscription?.remainingCredits || 0,
                    });
                  } else if (hasAttributes) {
                    return t("costInfoNoPriorityWithAttributes", {
                      baseCost: baseCreditCost,
                      credit: baseCreditCost === 1 ? t("credit") : t("credits"),
                      attributeCost: attributeCredits,
                      totalCost: totalCreditCost,
                      available: subscription?.remainingCredits || 0,
                    });
                  } else if (hasPriority) {
                    return t("costInfo", {
                      baseCost: baseCreditCost,
                      credit: baseCreditCost === 1 ? t("credit") : t("credits"),
                      priorityCost,
                      totalCost: totalCreditCost,
                      available: subscription?.remainingCredits || 0,
                    });
                  } else {
                    return t("costInfoNoPriority", {
                      baseCost: baseCreditCost,
                      credit: baseCreditCost === 1 ? t("credit") : t("credits"),
                      available: subscription?.remainingCredits || 0,
                    });
                  }
                })()
              : t("costInfoNoService", { available: subscription?.remainingCredits || 0 })}
          </CardDescription>
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
                <SelectContent>
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
                    const unsupportedMessage =
                      locale === "ar"
                        ? ` (مدعوم بداية من باقة ${packageName})`
                        : ` (supported in ${packageName} package)`;
                    const supportText = type.isSupported ? "" : unsupportedMessage;

                    return (
                      <SelectItem key={type.id} value={type.id} disabled={!type.isSupported}>
                        <span className="flex items-center gap-2">
                          <span>{type.icon}</span>
                          <span>{resolveLocalizedText(type.nameI18n, locale, type.name)}</span>
                          <span className="text-xs opacity-70">
                            • 💳 {type.creditCost || 1} {creditLabel}
                          </span>
                          {!type.isSupported && (
                            <span className="text-xs opacity-50">{supportText}</span>
                          )}
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
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md space-y-2">
                  <p className="text-sm text-blue-800">
                    {resolveLocalizedText(
                      (selectedService as any).descriptionI18n,
                      locale,
                      selectedService.description ?? undefined
                    )}
                  </p>
                  {!selectedService.isSupported &&
                    (selectedService as any).supportingPackages?.length > 0 && (
                      <p className="text-xs text-amber-700 font-medium">
                        {locale === "ar"
                          ? `⚠️ مدعوم في باقة ${resolveLocalizedText((selectedService as any).supportingPackages[0].nameI18n, locale, (selectedService as any).supportingPackages[0].name)}`
                          : `⚠️ Supported in ${resolveLocalizedText((selectedService as any).supportingPackages[0].nameI18n, locale, (selectedService as any).supportingPackages[0].name)} package`}
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

            <div className="flex gap-4">
              <Link href="/client/requests">
                <Button type="button" variant="outline">
                  {t("actions.cancel")}
                </Button>
              </Link>
              <Button type="submit" disabled={!canAffordService || createRequest.isPending}>
                {buttonText}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
