"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n";
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
import { ArrowLeft, Plus } from "lucide-react";
import type { AttributeResponse, ServiceAttribute } from "@/types/service-attributes";
import { calculateAttributeCredits } from "@/lib/attribute-validation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { LocalizedText } from "@/types/i18n";

type FieldKey = "client" | "serviceType" | "title" | "description";

function isAttrAnswerEmpty(answer: string | string[] | undefined): boolean {
  if (answer === undefined || answer === null) return true;
  if (typeof answer === "string") return answer.trim() === "";
  return answer.length === 0;
}

export default function AdminNewRequestPage() {
  const t = useTranslations("admin.requests.new");
  const tClient = useTranslations("client.newRequest");
  const router = useRouter();
  const locale = useLocale();

  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedServiceType, setSelectedServiceType] = useState("");
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [attributeResponses, setAttributeResponses] = useState<AttributeResponse[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [touched, setTouched] = useState<Partial<Record<FieldKey | string, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const { data: clients, isLoading: clientsLoading } = trpc.admin.getClientsForRequest.useQuery({
    search: clientSearch || undefined,
    limit: 100,
  });

  const { data: clientServices, isLoading: servicesLoading } =
    trpc.admin.getServiceTypesForClient.useQuery(
      { clientId: selectedClientId },
      { enabled: Boolean(selectedClientId) }
    );

  const { data: providers, isLoading: providersLoading } = trpc.admin.getProviders.useQuery(
    { serviceTypeId: selectedServiceType || undefined },
    { enabled: Boolean(selectedServiceType) }
  );

  const selectedClient = useMemo(
    () => clients?.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  const serviceTypes = useMemo(() => clientServices?.services ?? [], [clientServices?.services]);
  const remainingCredits =
    clientServices?.remainingCredits ?? selectedClient?.remainingCredits ?? 0;
  const hasActiveSubscription = Boolean(
    clientServices?.package || selectedClient?.hasActiveSubscription
  );

  const selectedService = useMemo(
    () => serviceTypes.find((s) => s.id === selectedServiceType),
    [serviceTypes, selectedServiceType]
  );

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedServiceType("");
      setSelectedProviderId("");
      setAttributeResponses([]);
      setTouched((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.startsWith("attr:")) delete next[key];
        }
        delete next.serviceType;
        return next;
      });
    });
  }, [selectedClientId]);

  useEffect(() => {
    queueMicrotask(() => {
      setAttributeResponses([]);
      setSelectedProviderId("");
      setTouched((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.startsWith("attr:")) delete next[key];
        }
        return next;
      });
    });
  }, [selectedServiceType]);

  const createRequest = trpc.admin.createRequest.useMutation({
    onSuccess: (data) => {
      toast.success(t("toast.created"), {
        description: data.message,
      });
      router.push(`/admin/requests/${data.request.id}`);
    },
    onError: (err: unknown) => {
      showError(err, t("toast.error"));
    },
  });

  const hasCredits = hasActiveSubscription && remainingCredits > 0;
  const baseCreditCost = selectedService?.creditCost || 1;

  const attributeCredits = useMemo(() => {
    if (!selectedService || !attributeResponses.length) return 0;
    const attributes = selectedService.attributes as ServiceAttribute[] | undefined;
    if (!attributes) return 0;
    return calculateAttributeCredits(attributes, attributeResponses);
  }, [selectedService, attributeResponses]);

  const totalCreditCost = baseCreditCost + attributeCredits;
  const canAffordService = hasActiveSubscription && remainingCredits >= totalCreditCost;
  const showInsufficientCredits =
    Boolean(selectedClientId) &&
    hasActiveSubscription &&
    (!hasCredits || (Boolean(selectedServiceType) && !canAffordService));
  const showNoSubscription =
    Boolean(selectedClientId) && !servicesLoading && !hasActiveSubscription;

  let buttonText = t("actions.create", { cost: totalCreditCost });
  if (createRequest.isPending) {
    buttonText = t("actions.creating");
  }

  const markTouched = useCallback((key: string) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const getClientError = useCallback(
    (value: string): string | null => {
      if (!value) return t("validation.selectClient");
      return null;
    },
    [t]
  );

  const getTitleError = useCallback(
    (value: string): string | null => {
      if (!value.trim()) return tClient("validation.requiredField");
      return null;
    },
    [tClient]
  );

  const getDescriptionError = useCallback(
    (value: string): string | null => {
      if (!value.trim()) return tClient("validation.requiredField");
      return null;
    },
    [tClient]
  );

  const getServiceError = useCallback(
    (value: string): string | null => {
      if (!value) return tClient("validation.selectService");
      return null;
    },
    [tClient]
  );

  const getAttributeErrors = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    const attributes = (selectedService?.attributes || []) as ServiceAttribute[];
    for (const attr of attributes) {
      if (!attr.required) continue;
      const response = attributeResponses.find((r) => r.question === attr.question);
      if (isAttrAnswerEmpty(response?.answer)) {
        const label = resolveLocalizedText(
          (attr as { questionI18n?: LocalizedText }).questionI18n,
          locale,
          attr.question
        );
        errors[attr.question] = tClient("validation.requiredAttribute", { field: label });
      }
    }
    return errors;
  }, [selectedService, attributeResponses, locale, tClient]);

  const showFieldError = (key: string) => submitAttempted || !!touched[key];

  const clientError = showFieldError("client") ? getClientError(selectedClientId) : null;
  const serviceError = showFieldError("serviceType") ? getServiceError(selectedServiceType) : null;
  const titleError = showFieldError("title") ? getTitleError(title) : null;
  const descriptionError = showFieldError("description") ? getDescriptionError(description) : null;
  const attributeErrors = getAttributeErrors();
  const visibleAttributeErrors = Object.fromEntries(
    Object.entries(attributeErrors).filter(
      ([question]) => submitAttempted || touched[`attr:${question}`]
    )
  );

  const formEnabled = Boolean(selectedClientId) && hasCredits && canAffordService;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitAttempted(true);

    const nextClientError = getClientError(selectedClientId);
    const nextServiceError = getServiceError(selectedServiceType);
    const nextTitleError = getTitleError(title);
    const nextDescriptionError = getDescriptionError(description);
    const nextAttrErrors = getAttributeErrors();

    if (
      nextClientError ||
      nextServiceError ||
      nextTitleError ||
      nextDescriptionError ||
      Object.keys(nextAttrErrors).length > 0
    ) {
      toast.error(tClient("toast.validationError"), {
        description: tClient("validation.fixErrors"),
      });
      return;
    }

    if (!canAffordService) {
      toast.error(t("insufficientCredits.title"));
      return;
    }

    createRequest.mutate({
      clientId: selectedClientId,
      providerId: selectedProviderId || undefined,
      title: title.trim(),
      description: description.trim(),
      serviceTypeId: selectedServiceType,
      attachments: attachments.map((f) => f.url),
      attributeResponses: attributeResponses.length > 0 ? attributeResponses : undefined,
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button asChild variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0">
          <Link href="/admin/requests" aria-label={t("actions.cancel")}>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

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
        </Card>
      )}

      {showInsufficientCredits && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40">
          <CardHeader>
            <CardTitle className="text-orange-800 dark:text-orange-200">
              {t("insufficientCredits.title")}
            </CardTitle>
            <CardDescription className="text-orange-700 dark:text-orange-300">
              {selectedServiceType
                ? t("insufficientCredits.description", {
                    required: totalCreditCost,
                    available: remainingCredits,
                  })
                : t("insufficientCredits.zeroCredits")}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("requestDetails")}</CardTitle>
          <CardDescription>{t("requestDetailsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div className="space-y-2">
              <Label htmlFor="clientSearch">{t("fields.clientSearch")}</Label>
              <Input
                id="clientSearch"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder={t("fields.clientSearchPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client" className="flex items-center gap-1">
                {t("fields.client")}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Select
                value={selectedClientId}
                onValueChange={(value) => {
                  setSelectedClientId(value);
                  markTouched("client");
                }}
                disabled={clientsLoading}
              >
                <SelectTrigger
                  id="client"
                  aria-invalid={!!clientError}
                  className={cn(clientError && "border-destructive focus:ring-destructive")}
                  onBlur={() => markTouched("client")}
                >
                  <SelectValue placeholder={t("fields.clientPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id} textValue={client.name}>
                      <span className="flex min-w-0 flex-col gap-0.5 text-start">
                        <span className="truncate font-medium">{client.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {client.email}
                          {" · "}
                          {client.hasActiveSubscription
                            ? t("fields.creditsAvailable", { count: client.remainingCredits })
                            : t("fields.noSubscription")}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientError && (
                <p className="text-sm text-destructive" role="alert">
                  {clientError}
                </p>
              )}
              {selectedClient && hasActiveSubscription && (
                <p className="text-sm text-muted-foreground">
                  {t("fields.clientCredits", {
                    count: remainingCredits,
                    package:
                      resolveLocalizedText(
                        clientServices?.package?.nameI18n as LocalizedText | null | undefined,
                        locale,
                        clientServices?.package?.name || selectedClient.package?.name
                      ) || "—",
                  })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceType" className="flex items-center gap-1">
                {tClient("fields.serviceType")}
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
                disabled={!selectedClientId || !hasCredits || servicesLoading}
              >
                <SelectTrigger
                  id="serviceType"
                  aria-invalid={!!serviceError}
                  className={cn(serviceError && "border-destructive focus:ring-destructive")}
                  onBlur={() => markTouched("serviceType")}
                >
                  <SelectValue placeholder={tClient("fields.serviceTypePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((type) => {
                    const serviceName = resolveLocalizedText(
                      type.nameI18n as LocalizedText | null | undefined,
                      locale,
                      type.name
                    );
                    const creditCost = type.creditCost || 1;
                    return (
                      <SelectItem
                        key={type.id}
                        value={type.id}
                        disabled={!type.isSupported}
                        textValue={serviceName}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate font-medium">{serviceName}</span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {creditCost} {creditCost === 1 ? tClient("credit") : tClient("credits")}
                          </span>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">{t("fields.provider")}</Label>
              <Select
                value={selectedProviderId || "__none__"}
                onValueChange={(value) => setSelectedProviderId(value === "__none__" ? "" : value)}
                disabled={!selectedServiceType || providersLoading}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder={t("fields.providerPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("fields.providerNone")}</SelectItem>
                  {providers?.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id} textValue={provider.name}>
                      <span className="flex min-w-0 flex-col gap-0.5 text-start">
                        <span className="truncate font-medium">{provider.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {provider.email} · {provider.activeRequests} {t("fields.activeJobs")}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("fields.providerHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center gap-1">
                {tClient("fields.title")}
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
                placeholder={tClient("fields.titlePlaceholder")}
                disabled={!formEnabled && !hasCredits}
                aria-invalid={!!titleError}
                className={cn(titleError && "border-destructive focus-visible:ring-destructive")}
              />
              {titleError && (
                <p className="text-sm text-destructive" role="alert">
                  {titleError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="flex items-center gap-1">
                {tClient("fields.description")}
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
                placeholder={tClient("fields.descriptionPlaceholder")}
                rows={6}
                disabled={!formEnabled && !hasCredits}
                aria-invalid={!!descriptionError}
                className={cn(
                  descriptionError && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {descriptionError && (
                <p className="text-sm text-destructive" role="alert">
                  {descriptionError}
                </p>
              )}
            </div>

            {selectedService &&
              Array.isArray(selectedService.attributes) &&
              (selectedService.attributes as ServiceAttribute[]).length > 0 && (
                <ServiceAttributesForm
                  attributes={selectedService.attributes as ServiceAttribute[]}
                  responses={attributeResponses}
                  onChange={setAttributeResponses}
                  disabled={(!formEnabled && !hasCredits) || createRequest.isPending}
                  showErrors={submitAttempted}
                  fieldErrors={visibleAttributeErrors}
                  onFieldBlur={(question) => markTouched(`attr:${question}`)}
                  onFieldChange={(question) => markTouched(`attr:${question}`)}
                />
              )}

            <div className="space-y-2">
              <Label>{tClient("fields.attachments")}</Label>
              <FileUpload
                onFilesChange={setAttachments}
                maxFiles={5}
                maxSizeMB={500}
                disabled={(!formEnabled && !hasCredits) || createRequest.isPending}
              />
            </div>

            {selectedServiceType && hasActiveSubscription && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span>{tClient("costSummary.total")}</span>
                  <span className="font-medium tabular-nums">
                    {totalCreditCost}{" "}
                    {totalCreditCost === 1 ? tClient("credit") : tClient("credits")}
                  </span>
                </div>
                <div className="flex justify-between gap-2 text-muted-foreground">
                  <span>{tClient("costSummary.available")}</span>
                  <span className="tabular-nums">{remainingCredits}</span>
                </div>
                <div className="flex justify-between gap-2 text-muted-foreground">
                  <span>{tClient("costSummary.remaining")}</span>
                  <span className="tabular-nums">
                    {Math.max(0, remainingCredits - totalCreditCost)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button asChild variant="outline" type="button">
                <Link href="/admin/requests">{t("actions.cancel")}</Link>
              </Button>
              <Button
                type="submit"
                disabled={!formEnabled || createRequest.isPending}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {buttonText}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
