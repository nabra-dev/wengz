"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";
import { formatDate } from "@/lib/utils";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import { resolveLocalizedText } from "@/lib/i18n";
import { showError, showSuccess } from "@/lib/error-handler";
import {
  Check,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  DollarSign,
  Users,
  AlertTriangle,
} from "lucide-react";

type PaymentProof = {
  id: string;
  transferImage: string;
  senderName: string;
  senderBank: string;
  senderCountry: string;
  amount: number;
  currency: string;
  transferDate: Date;
  referenceNumber: string | null;
  notes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  subscription: {
    id: string;
    package: {
      id: string;
      name: string;
      price: number;
      credits: number;
    };
  };
  reviewer?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

function getStatusBadgeVariant(status: string) {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED") return "destructive";
  return "secondary";
}

function StatusIcon({ status }: { readonly status: string }) {
  if (status === "PENDING") return <Clock className="h-3 w-3" />;
  if (status === "APPROVED") return <CheckCircle2 className="h-3 w-3" />;
  return <XCircle className="h-3 w-3" />;
}

export default function AdminPaymentsPage() {
  const t = useTranslations("admin.payments");
  const locale = useLocale();
  const formatCurrency = useFormatCurrency();
  const utils = trpc.useUtils();
  const [selectedPayment, setSelectedPayment] = useState<PaymentProof | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approvePaymentId, setApprovePaymentId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = trpc.payment.getStats.useQuery();
  const { data: pendingPayments, isLoading: pendingLoading } =
    trpc.payment.getPendingPayments.useQuery();
  const { data: allPaymentsData, isLoading: allLoading } = trpc.payment.getAllPayments.useQuery({});

  const approveMutation = trpc.payment.approvePayment.useMutation({
    onSuccess: () => {
      setApprovePaymentId(null);
      showSuccess(t("toast.approved"));
      utils.payment.getPendingPayments.invalidate();
      utils.payment.getAllPayments.invalidate();
      utils.payment.getStats.invalidate();
      setSelectedPayment(null);
    },
    onError: (error) => {
      showError(error);
    },
  });

  const rejectMutation = trpc.payment.rejectPayment.useMutation({
    onSuccess: () => {
      showSuccess(t("toast.rejected"));
      utils.payment.getPendingPayments.invalidate();
      utils.payment.getAllPayments.invalidate();
      utils.payment.getStats.invalidate();
      setSelectedPayment(null);
      setShowRejectDialog(false);
      setRejectReason("");
    },
    onError: (error) => {
      showError(error);
    },
  });

  const handleApprove = (paymentId: string) => {
    setApprovePaymentId(paymentId);
  };

  const handleConfirmApprove = () => {
    if (!approvePaymentId) return;
    approveMutation.mutate({ paymentId: approvePaymentId });
  };

  const handleReject = () => {
    if (!selectedPayment) return;
    if (!rejectReason.trim()) {
      showError(t("reject.errorMinLength"));
      return;
    }
    rejectMutation.mutate({
      paymentId: selectedPayment.id,
      reason: rejectReason,
    });
  };

  const renderPaymentRow = (payment: PaymentProof) => {
    const badgeVariant = getStatusBadgeVariant(payment.status);
    return (
      <TableRow key={payment.id}>
        <TableCell>
          <div>
            <p className="font-medium">{payment.user.name ?? "Pending name"}</p>
            <p className="text-sm text-muted-foreground">{payment.user.email}</p>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">
              {resolveLocalizedText(
                (payment.subscription.package as any).nameI18n,
                locale,
                payment.subscription.package.name
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(payment.subscription.package.price)}
            </p>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{formatCurrency(payment.amount)}</p>
            <p className="text-sm text-muted-foreground">{payment.senderBank}</p>
          </div>
        </TableCell>
        <TableCell>{formatDate(payment.transferDate, locale)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Badge
              variant={badgeVariant}
              className="px-2 py-1 text-xs rounded flex items-center gap-1 min-w-[90px] justify-center"
            >
              <StatusIcon status={payment.status} />
              <span className="capitalize">{t(`status.${payment.status}`)}</span>
            </Badge>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedPayment(payment)}>
              <Eye className="h-4 w-4" />
            </Button>
            {payment.status === "PENDING" && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleApprove(payment.id)}
                  disabled={approveMutation.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setSelectedPayment(payment);
                    setShowRejectDialog(true);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {statsLoading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("stats.pending")}</p>
                    <p className="text-3xl font-bold text-muted-foreground">
                      {stats?.pending || 0}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("stats.approved")}</p>
                    <p className="text-3xl font-bold text-primary">{stats?.approved || 0}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("stats.rejected")}</p>
                    <p className="text-3xl font-bold text-destructive">{stats?.rejected || 0}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("stats.total")}</p>
                    <p className="text-3xl font-bold">{stats?.total || 0}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            {t("tabs.pendingCount", { count: stats?.pending || 0 })}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <Users className="h-4 w-4" />
            {t("tabs.all")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>{t("cards.pendingTitle")}</CardTitle>
              <CardDescription>{t("cards.pendingDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingLoading && <Skeleton className="h-48" />}
              {!pendingLoading && !pendingPayments?.length && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <p>{t("empty.noPending")}</p>
                </div>
              )}
              {!pendingLoading && pendingPayments && pendingPayments.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.client")}</TableHead>
                      <TableHead>{t("table.package")}</TableHead>
                      <TableHead>{t("table.amount")}</TableHead>
                      <TableHead>{t("table.date")}</TableHead>
                      <TableHead>{t("table.status")}</TableHead>
                      <TableHead>{t("table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayments.map((payment: PaymentProof) => renderPaymentRow(payment))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>{t("cards.allTitle")}</CardTitle>
              <CardDescription>{t("cards.allDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {allLoading && <Skeleton className="h-48" />}
              {!allLoading && !allPaymentsData?.payments?.length && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t("empty.noPayments")}</p>
                </div>
              )}
              {!allLoading && allPaymentsData?.payments && allPaymentsData.payments.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.client")}</TableHead>
                      <TableHead>{t("table.package")}</TableHead>
                      <TableHead>{t("table.amount")}</TableHead>
                      <TableHead>{t("table.date")}</TableHead>
                      <TableHead>{t("table.status")}</TableHead>
                      <TableHead>{t("table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPaymentsData.payments.map((payment: PaymentProof) =>
                      renderPaymentRow(payment)
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Payment Details Dialog */}
      <Dialog
        open={!!selectedPayment && !showRejectDialog}
        onOpenChange={() => setSelectedPayment(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("details.title")}</DialogTitle>
            <DialogDescription>{t("details.description")}</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              {/* Transfer Receipt Image */}
              <div className="border rounded-lg overflow-hidden">
                <img
                  src={selectedPayment.transferImage}
                  alt={t("details.transferReceipt")}
                  className="w-full max-h-64 object-contain bg-muted"
                />
              </div>

              {/* Details Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t("details.client")}</Label>
                  <p className="font-medium">{selectedPayment.user.name ?? "Pending name"}</p>
                  <p className="text-sm text-muted-foreground">{selectedPayment.user.email}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t("details.package")}</Label>
                  <p className="font-medium">
                    {resolveLocalizedText(
                      (selectedPayment.subscription.package as any).nameI18n,
                      locale,
                      selectedPayment.subscription.package.name
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(selectedPayment.subscription.package.price)} -{" "}
                    {selectedPayment.subscription.package.credits} {t("details.credits")}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t("details.amountSent")}</Label>
                  <p className="font-medium text-lg">
                    {formatCurrency(selectedPayment.amount)}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t("details.transferDate")}</Label>
                  <p className="font-medium">{formatDate(selectedPayment.transferDate, locale)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t("details.senderName")}</Label>
                  <p className="font-medium">{selectedPayment.senderName}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t("details.senderBank")}</Label>
                  <p className="font-medium">{selectedPayment.senderBank}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t("details.country")}</Label>
                  <p className="font-medium">{selectedPayment.senderCountry}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t("details.referenceNumber")}</Label>
                  <p className="font-medium">
                    {selectedPayment.referenceNumber || t("details.awaitingReference")}
                  </p>
                </div>
              </div>

              {selectedPayment.notes && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t("details.notes")}</Label>
                  <p className="p-2 bg-muted rounded">{selectedPayment.notes}</p>
                </div>
              )}

              {selectedPayment.status === "REJECTED" && selectedPayment.rejectionReason && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium">
                    {t("details.rejectionReason")}
                  </p>
                  <p className="text-foreground">{selectedPayment.rejectionReason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedPayment?.status === "PENDING" && (
              <div className="flex gap-2 w-full">
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                  className="flex-1 flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  {t("buttons.reject")}
                </Button>
                <Button
                  onClick={() => handleApprove(selectedPayment.id)}
                  disabled={approveMutation.isPending}
                  className="flex-1 flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  {t("buttons.approve")}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reject.title")}</DialogTitle>
            <DialogDescription>{t("reject.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejectReason">{t("reject.reasonLabel")}</Label>
              <Textarea
                id="rejectReason"
                placeholder={t("reject.reasonPlaceholder")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">{t("reject.reasonHint")}</p>
            </div>
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                {t("buttons.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
              >
                {rejectMutation.isPending ? t("reject.rejecting") : t("reject.button")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!approvePaymentId}
        onOpenChange={(open) => {
          if (!open) setApprovePaymentId(null);
        }}
        title={t("buttons.approve")}
        description={t("confirmations.approve")}
        confirmLabel={t("buttons.approve")}
        loading={approveMutation.isPending}
        onConfirm={handleConfirmApprove}
      />
    </div>
  );
}
