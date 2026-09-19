"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n";
import "react-datepicker/dist/react-datepicker.css";
import "./datepicker.css";

const DatePicker = dynamic(
  () => import("react-datepicker").then((mod) => mod.default as unknown as React.ComponentType<any>),
  { ssr: false }
);
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileUpload } from "@/components/ui/file-upload";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { showError, showSuccess } from "@/lib/error-handler";
import {
  Upload,
  Copy,
  Check,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar as CalendarIcon,
  Receipt,
  Smartphone,
  CreditCard,
  Landmark,
  Sparkles,
} from "lucide-react";
import type { PaymentMethodId } from "@/lib/payment-settings";

// Explicit types for the data
interface PaymentProof {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  senderName: string;
  senderBank: string;
  senderCountry: string;
  amount: number;
  transferDate: Date;
  createdAt: Date;
  rejectionReason?: string | null;
}

interface Package {
  id: string;
  name: string;
  price: number;
  credits: number;
}

interface PendingSubscription {
  id: string;
  package: Package;
  paymentProof: PaymentProof | null;
}

interface PaymentMethodInfo {
  id: PaymentMethodId;
  category: "manual" | "local" | "international";
  available: boolean;
  comingSoon: boolean;
}

interface PaymentInfo {
  bankName: string;
  accountName: string;
  iban: string;
  swiftCode: string;
  currency: string;
  note: string;
  instapayEnabled: boolean;
  instapayLink?: string;
  methods: PaymentMethodInfo[];
}

interface FormData {
  senderName: string;
  senderBank: string;
  senderCountry: string;
  transferDate: Date | null;
  referenceNumber: string;
  notes: string;
  transferImageUrl: string;
}

interface FormErrors {
  senderName?: string;
  senderBank?: string;
  senderCountry?: string;
  transferDate?: string;
  referenceNumber?: string;
  notes?: string;
  transferImageUrl?: string;
}

function getStatusBadgeVariant(status: string) {
  if (status === "APPROVED") return "default" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "secondary" as const;
}

// Component for when there's no pending payment
function NoPendingPayment() {
  const router = useRouter();
  const t = useTranslations("client.payment");
  const locale = useLocale();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t("noPendingPayment.title")}</h3>
          <p className="text-muted-foreground mb-4">{t("noPendingPayment.description")}</p>
          <Button onClick={() => router.push("/client/subscription")}>
            {t("noPendingPayment.viewSubscriptions")}
          </Button>
        </CardContent>
      </Card>

      {/* Transaction history */}
      <TransactionsSection locale={locale} />
    </div>
  );
}

// Component for payment status display (when proof already submitted)
function PaymentStatus({
  subscription,
  locale,
}: {
  subscription: PendingSubscription;
  locale: string;
}) {
  const router = useRouter();
  const t = useTranslations("client.payment");
  const tAdmin = useTranslations("admin.payments");
  const proof = subscription.paymentProof!;
  const badgeVariant = getStatusBadgeVariant(proof.status);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("statusTitle")}</h1>
        <p className="text-muted-foreground">{t("statusSubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {resolveLocalizedText(
                  (subscription.package as any).nameI18n,
                  locale,
                  subscription.package.name
                )}
              </CardTitle>
              <CardDescription>
                {formatCurrency(subscription.package.price, locale)}
              </CardDescription>
            </div>
            <Badge variant={badgeVariant} className="flex items-center gap-1">
              {proof.status === "PENDING" && <Clock className="h-3 w-3" />}
              {proof.status === "APPROVED" && <CheckCircle2 className="h-3 w-3" />}
              {proof.status === "REJECTED" && <XCircle className="h-3 w-3" />}
              {tAdmin(`status.${proof.status}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {proof.status === "PENDING" && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>{t("status.pending")}</AlertTitle>
              <AlertDescription>{t("status.pendingDesc")}</AlertDescription>
            </Alert>
          )}

          {proof.status === "REJECTED" && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>{t("status.rejected")}</AlertTitle>
              <AlertDescription>
                {proof.rejectionReason ?? t("status.rejectedDesc")}
              </AlertDescription>
            </Alert>
          )}

          {proof.status === "APPROVED" && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">{t("status.approved")}</AlertTitle>
              <AlertDescription className="text-green-700">
                {t("status.approvedDesc")}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{t("info.amountPaid")}</p>
              <p className="text-xl font-bold">{formatCurrency(proof.amount, locale)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{t("info.transferDate")}</p>
              <p className="text-xl font-bold">{formatDate(proof.transferDate, locale)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{t("info.sender")}</p>
              <p className="font-medium">{proof.senderName}</p>
              <p className="text-sm text-muted-foreground">
                {proof.senderBank}, {proof.senderCountry}
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{t("info.submitted")}</p>
              <p className="font-medium">{formatDate(proof.createdAt, locale)}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => router.push("/client/subscription")}>
            {t("actions.backToSubscription")}
          </Button>
        </CardFooter>
      </Card>

      {/* Transaction history */}
      <TransactionsSection locale={locale} />
    </div>
  );
}

// Copy button component
function CopyButton({
  field,
  value,
  copied,
  onCopy,
}: {
  field: string;
  value: string;
  copied: string | null;
  onCopy: (text: string, field: string) => void;
}) {
  return (
    <Button size="sm" variant="ghost" onClick={() => onCopy(value, field)}>
      {copied === field ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

// Transactions section embedded in payment page
function TransactionsSection({ locale }: { locale: string }) {
  const t = useTranslations("client.transactions");
  const tAdmin = useTranslations("admin.payments");
  const { data: transactions, isLoading } = trpc.subscription.getTransactionHistory.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {transactions && transactions.length > 0 ? (
        <div className="space-y-4">
          {transactions.map((tx: any) => (
            <Card key={tx.id} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      {resolveLocalizedText(tx.packageNameI18n, locale, tx.packageName)}
                    </CardTitle>
                    <CardDescription>{formatDate(tx.createdAt, locale)}</CardDescription>
                  </div>
                  {(() => {
                    let statusLabel: string;
                    if (tx.paymentProof?.status) {
                      statusLabel = tAdmin(`status.${tx.paymentProof.status}`);
                    } else {
                      statusLabel = tx.isActive ? t("status.active") : t("status.expired");
                    }

                    let badgeVariant: "default" | "destructive" | "secondary" = "secondary";
                    if (tx.paymentProof?.status === "APPROVED") badgeVariant = "default";
                    else if (tx.paymentProof?.status === "REJECTED") badgeVariant = "destructive";
                    else if (tx.isActive) badgeVariant = "default";

                    return <Badge variant={badgeVariant}>{statusLabel}</Badge>;
                  })()}
                </div>
              </CardHeader>
              <CardContent className="pt-6 grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("subscription.credits")}</span>
                    <span className="font-medium">{tx.credits}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("subscription.startDate")}</span>
                    <span className="font-medium">{formatDate(tx.startDate, locale)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("subscription.endDate")}</span>
                    <span className="font-medium">{formatDate(tx.endDate, locale)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("payment.amount")}</span>
                    <span className="font-medium">
                      {(() => {
                        if (tx.paymentProof) {
                          return (
                            formatCurrency(tx.paymentProof.amount, locale) +
                            " " +
                            tx.paymentProof.currency
                          );
                        }
                        if (tx.isFreePackage) {
                          return t("payment.free");
                        }
                        return formatCurrency(tx.packagePrice, locale);
                      })()}
                    </span>
                  </div>
                  {tx.paymentProof?.transferDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("payment.transferDate")}</span>
                      <span className="font-medium">
                        {formatDate(tx.paymentProof.transferDate, locale)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="font-medium">{t("empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Component for bank details card
function BankDetailsCard({
  subscription,
  paymentInfo,
  selectedMethod,
  copied,
  onCopy,
  locale,
}: {
  subscription: PendingSubscription;
  paymentInfo: PaymentInfo;
  selectedMethod: "bank_transfer" | "instapay";
  copied: string | null;
  onCopy: (text: string, field: string) => void;
  locale: string;
}) {
  const t = useTranslations("client.payment");
  const showInstapay = selectedMethod === "instapay" && Boolean(paymentInfo.instapayLink);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {showInstapay ? <Smartphone className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
          {showInstapay ? t("bankDetails.instapayTitle") : t("bankDetails.title")}
        </CardTitle>
        <CardDescription>
          {showInstapay ? t("bankDetails.instapayDescription") : t("bankDetails.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Package Info */}
        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">
              {resolveLocalizedText(
                (subscription.package as any).nameI18n,
                locale,
                subscription.package.name
              )}
            </span>
            <Badge>
              {subscription.package.credits} {t("badges.credits")}
            </Badge>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(subscription.package.price, locale)}</p>
        </div>

        {/* Transfer Details */}
        <div className="space-y-3">
          {showInstapay && paymentInfo.instapayLink && (
            <div className="flex items-center justify-between gap-3 p-3 bg-muted rounded-lg">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("bankDetails.instapay")}</p>
                <a
                  href={paymentInfo.instapayLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline break-all"
                >
                  {paymentInfo.instapayLink}
                </a>
              </div>
              <CopyButton
                field="instapayLink"
                value={paymentInfo.instapayLink}
                copied={copied}
                onCopy={onCopy}
              />
            </div>
          )}

          {!showInstapay && (
            <>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">{t("bankDetails.bankName")}</p>
                  <p className="font-medium">{paymentInfo.bankName}</p>
                </div>
                <CopyButton
                  field="bankName"
                  value={paymentInfo.bankName}
                  copied={copied}
                  onCopy={onCopy}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">{t("bankDetails.accountName")}</p>
                  <p className="font-medium">{paymentInfo.accountName}</p>
                </div>
                <CopyButton
                  field="accountName"
                  value={paymentInfo.accountName}
                  copied={copied}
                  onCopy={onCopy}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">{t("bankDetails.iban")}</p>
                  <p className="font-mono font-medium">{paymentInfo.iban}</p>
                </div>
                <CopyButton field="iban" value={paymentInfo.iban} copied={copied} onCopy={onCopy} />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">{t("bankDetails.swiftCode")}</p>
                  <p className="font-mono font-medium">{paymentInfo.swiftCode}</p>
                </div>
                <CopyButton
                  field="swiftCode"
                  value={paymentInfo.swiftCode}
                  copied={copied}
                  onCopy={onCopy}
                />
              </div>
            </>
          )}
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {showInstapay ? t("bankDetails.instapayNote") : paymentInfo.note || t("bankDetails.note")}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function MethodIcon({ id, className }: { id: PaymentMethodId; className?: string }) {
  switch (id) {
    case "bank_transfer":
      return <Landmark className={className} />;
    case "instapay":
      return <Smartphone className={className} />;
    case "fawry":
      return <Receipt className={className} />;
    case "meeza":
    case "visa":
    case "mastercard":
    default:
      return <CreditCard className={className} />;
  }
}

function PaymentMethodPicker({
  methods,
  selected,
  onSelect,
}: {
  methods: PaymentMethodInfo[];
  selected: PaymentMethodId;
  onSelect: (id: PaymentMethodId) => void;
}) {
  const t = useTranslations("client.payment.methods");

  const groups: Array<{ key: "manual" | "local" | "international"; items: PaymentMethodInfo[] }> = [
    { key: "manual", items: methods.filter((m) => m.category === "manual") },
    { key: "local", items: methods.filter((m) => m.category === "local") },
    { key: "international", items: methods.filter((m) => m.category === "international") },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {groups.map((group) =>
        group.items.length === 0 ? null : (
          <div key={group.key} className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t(`categories.${group.key}`)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((method) => {
                const isSelected = selected === method.id;
                const disabled = !method.available || method.comingSoon;

                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => onSelect(method.id)}
                    className={`relative overflow-hidden rounded-xl border p-4 text-start transition ${
                      isSelected && !disabled
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <MethodIcon id={method.id} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{t(`items.${method.id}.name`)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t(`items.${method.id}.hint`)}
                        </p>
                      </div>
                    </div>

                    {method.comingSoon && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/75 backdrop-blur-[2px]">
                        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-semibold shadow-sm">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          {t("comingSoon")}
                        </span>
                      </div>
                    )}

                    {!method.comingSoon && !method.available && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
                        <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                          {t("unavailable")}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function ComingSoonPanel({ methodId }: { methodId: PaymentMethodId }) {
  const t = useTranslations("client.payment.methods");

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-muted/40" />
      <CardContent className="relative py-16 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <MethodIcon id={methodId} className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            {t("comingSoon")}
          </Badge>
          <h3 className="text-xl font-semibold">{t(`items.${methodId}.name`)}</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t("comingSoonDescription")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}


// Component for payment proof form
function PaymentProofForm({
  subscriptionId,
  packagePrice,
  onSuccess,
}: {
  subscriptionId: string;
  packagePrice: number;
  onSuccess: () => void;
}) {
  const t = useTranslations("client.payment");
  const [formData, setFormData] = useState<FormData>({
    senderName: "",
    senderBank: "",
    senderCountry: "",
    transferDate: null,
    referenceNumber: "",
    notes: "",
    transferImageUrl: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const submitProofMutation = trpc.payment.submitProof.useMutation({
    onSuccess: () => {
      showSuccess(t("toast.submitted"));
      onSuccess();
    },
    onError: (error) => {
      showError(error);
    },
  });

  const handleFilesChange = (files: any[]) => {
    if (files.length > 0) {
      setFormData((prev) => ({ ...prev, transferImageUrl: files[0].url }));
    } else {
      setFormData((prev) => ({ ...prev, transferImageUrl: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.transferImageUrl) {
      newErrors.transferImageUrl = t("validation.transferReceiptRequired");
    }

    if (!formData.senderName || formData.senderName.trim().length < 2) {
      newErrors.senderName = t("validation.senderNameMin");
    } else if (formData.senderName.length > 100) {
      newErrors.senderName = t("validation.senderNameMax");
    }

    if (!formData.senderBank || formData.senderBank.trim().length < 2) {
      newErrors.senderBank = t("validation.senderBankMin");
    } else if (formData.senderBank.length > 100) {
      newErrors.senderBank = t("validation.senderBankMax");
    }

    if (!formData.senderCountry || formData.senderCountry.trim().length < 2) {
      newErrors.senderCountry = t("validation.senderCountryMin");
    } else if (formData.senderCountry.length > 100) {
      newErrors.senderCountry = t("validation.senderCountryMax");
    }

    if (!formData.transferDate) {
      newErrors.transferDate = t("validation.transferDateRequired");
    } else if (formData.transferDate > new Date()) {
      newErrors.transferDate = t("validation.transferDateFuture");
    }

    if (formData.referenceNumber && formData.referenceNumber.length > 50) {
      newErrors.referenceNumber = t("validation.referenceNumberMax");
    }

    if (formData.notes && formData.notes.length > 500) {
      newErrors.notes = t("validation.notesMax");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showError(t("validation.fixErrors"));
      return;
    }

    submitProofMutation.mutate({
      subscriptionId,
      transferImage: formData.transferImageUrl,
      senderName: formData.senderName,
      senderBank: formData.senderBank,
      senderCountry: formData.senderCountry,
      amount: packagePrice,
      currency: "USD",
      transferDate: formData.transferDate!,
      referenceNumber: formData.referenceNumber || undefined,
      notes: formData.notes || undefined,
    });
  };

  const updateField = (field: keyof Omit<FormData, "transferDate">, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const updateDateField = (date: Date | null) => {
    setFormData((prev) => ({ ...prev, transferDate: date }));
    // Clear error for this field when user selects a date
    if (errors.transferDate) {
      setErrors((prev) => ({ ...prev, transferDate: undefined }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {t("uploadProof.title")}
        </CardTitle>
        <CardDescription>{t("uploadProof.description")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>{t("uploadProof.transferReceipt")}</Label>
            <FileUpload
              onFilesChange={handleFilesChange}
              maxFiles={1}
              maxSizeMB={10}
              accept="image/*"
            />
            {errors.transferImageUrl && (
              <p className="text-sm text-destructive">{errors.transferImageUrl}</p>
            )}
            <p className="text-xs text-muted-foreground">{t("uploadProof.uploadImage")}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="senderName">{t("uploadProof.senderName")}</Label>
              <Input
                id="senderName"
                placeholder={t("uploadProof.senderNamePlaceholder")}
                required
                minLength={2}
                maxLength={100}
                value={formData.senderName}
                onChange={(e) => updateField("senderName", e.target.value)}
                className={errors.senderName ? "border-destructive" : ""}
              />
              {errors.senderName && <p className="text-sm text-destructive">{errors.senderName}</p>}
              <p className="text-xs text-muted-foreground">
                {t("uploadProof.charactersHint", { min: 2, max: 100 })}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderBank">{t("uploadProof.senderBank")}</Label>
              <Input
                id="senderBank"
                placeholder={t("uploadProof.senderBankPlaceholder")}
                required
                minLength={2}
                maxLength={100}
                value={formData.senderBank}
                onChange={(e) => updateField("senderBank", e.target.value)}
                className={errors.senderBank ? "border-destructive" : ""}
              />
              {errors.senderBank && <p className="text-sm text-destructive">{errors.senderBank}</p>}
              <p className="text-xs text-muted-foreground">
                {t("uploadProof.charactersHint", { min: 2, max: 100 })}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="senderCountry">{t("uploadProof.senderCountry")}</Label>
              <Input
                id="senderCountry"
                placeholder={t("uploadProof.senderCountryPlaceholder")}
                required
                minLength={2}
                maxLength={100}
                value={formData.senderCountry}
                onChange={(e) => updateField("senderCountry", e.target.value)}
                className={errors.senderCountry ? "border-destructive" : ""}
              />
              {errors.senderCountry && (
                <p className="text-sm text-destructive">{errors.senderCountry}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("uploadProof.charactersHint", { min: 2, max: 100 })}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transferDate">{t("uploadProof.transferDate")}</Label>
              <div className="relative">
                <DatePicker
                  id="transferDate"
                  selected={formData.transferDate}
                  onChange={(date: Date | null) => updateDateField(date)}
                  dateFormat="yyyy-MM-dd"
                  maxDate={new Date()}
                  placeholderText={t("uploadProof.transferDatePlaceholder")}
                  required
                  className={`flex h-10 w-full rounded-md border ${errors.transferDate ? "border-destructive" : "border-input"} bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                  calendarClassName="!bg-background !border-border"
                  wrapperClassName="w-full"
                />
                <CalendarIcon className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {errors.transferDate && (
                <p className="text-sm text-destructive">{errors.transferDate}</p>
              )}
              <p className="text-xs text-muted-foreground">{t("uploadProof.transferDateHint")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referenceNumber">{t("uploadProof.referenceNumber")}</Label>
            <Input
              id="referenceNumber"
              placeholder={t("uploadProof.referenceNumberPlaceholder")}
              maxLength={50}
              value={formData.referenceNumber}
              onChange={(e) => updateField("referenceNumber", e.target.value)}
              className={errors.referenceNumber ? "border-destructive" : ""}
            />
            {errors.referenceNumber && (
              <p className="text-sm text-destructive">{errors.referenceNumber}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {t("uploadProof.maxCharactersHint", { max: 50 })}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("uploadProof.notes")}</Label>
            <Textarea
              id="notes"
              placeholder={t("uploadProof.notesPlaceholder")}
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={submitProofMutation.isPending}>
            {submitProofMutation.isPending ? t("uploadProof.submitting") : t("uploadProof.submit")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// Main page component
export default function PaymentPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const t = useTranslations("client.payment");
  const locale = useLocale();
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>("bank_transfer");

  const { data: pendingSubscriptionData, isLoading: subLoading } =
    trpc.subscription.getPending.useQuery(undefined, {
      refetchOnMount: "always",
      staleTime: 0,
    });
  const { data: paymentInfoData, isLoading: infoLoading } = trpc.payment.getPaymentInfo.useQuery();

  const cancelMutation = trpc.subscription.cancel.useMutation({
    onSuccess: () => {
      utils.subscription.getPending.invalidate();
      utils.subscription.getActive.invalidate();
      showSuccess(t("toast.cancelled"));
      router.push("/client/subscription");
    },
    onError: (error) => {
      showError(error);
    },
  });

  // Cast to our explicit types
  const pendingSubscription = pendingSubscriptionData as PendingSubscription | null | undefined;
  const paymentInfo = paymentInfoData as PaymentInfo | undefined;

  const isLoading = subLoading || infoLoading;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const availableMethods = paymentInfo?.methods?.filter((m) => m.available && !m.comingSoon) ?? [];
  const activeSelected =
    paymentInfo?.methods?.some((m) => m.id === selectedMethod)
      ? selectedMethod
      : availableMethods[0]?.id ?? "bank_transfer";
  const selectedMeta = paymentInfo?.methods?.find((m) => m.id === activeSelected);
  const isManualMethod = activeSelected === "bank_transfer" || activeSelected === "instapay";
  const showManualFlow = Boolean(
    selectedMeta?.available && !selectedMeta.comingSoon && isManualMethod
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{t("completePayment.title")}</h1>
          <p className="text-muted-foreground">{t("completePayment.subtitle")}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  // No pending subscription
  if (!pendingSubscription) {
    return <NoPendingPayment />;
  }

  // Payment already submitted
  if (pendingSubscription.paymentProof) {
    return <PaymentStatus subscription={pendingSubscription} locale={locale} />;
  }

  const handleCancelSubscription = () => {
    if (confirm(t("actions.cancelConfirm"))) {
      cancelMutation.mutate({ subscriptionId: pendingSubscription.id });
    }
  };

  // Show payment form
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">{t("completePayment.title")}</h1>
          <p className="text-muted-foreground">{t("completePayment.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          onClick={handleCancelSubscription}
          disabled={cancelMutation.isPending}
        >
          {cancelMutation.isPending ? t("actions.cancelling") : t("actions.cancelSubscription")}
        </Button>
      </div>

      {paymentInfo?.methods && (
        <PaymentMethodPicker
          methods={paymentInfo.methods}
          selected={activeSelected}
          onSelect={setSelectedMethod}
        />
      )}

      {(() => {
        if (selectedMeta?.comingSoon || !selectedMeta?.available) {
          return <ComingSoonPanel methodId={activeSelected} />;
        }
        if (showManualFlow && paymentInfo) {
          return (
            <div className="grid gap-6 lg:grid-cols-2">
              <BankDetailsCard
                subscription={pendingSubscription}
                paymentInfo={paymentInfo}
                selectedMethod={activeSelected as "bank_transfer" | "instapay"}
                copied={copied}
                onCopy={copyToClipboard}
                locale={locale}
              />
              <PaymentProofForm
                subscriptionId={pendingSubscription.id}
                packagePrice={pendingSubscription.package.price}
                onSuccess={() => utils.subscription.getPending.invalidate()}
              />
            </div>
          );
        }
        return <ComingSoonPanel methodId={activeSelected} />;
      })()}

      {/* Transaction history */}
      <TransactionsSection locale={locale} />
    </div>
  );
}
