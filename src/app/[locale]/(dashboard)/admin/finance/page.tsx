"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { showError, showSuccess } from "@/lib/error-handler";
import { resolveLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc/client";
import { CheckCircle, Clock, CreditCard, Wallet } from "lucide-react";

type PayoutMethod = "BANK" | "E_WALLET";
type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED";

type PayoutDetails = {
  payoutMethod: PayoutMethod | null;
  accountHolder: string | null;
  bankName: string | null;
  bankAccount: string | null;
  eWalletNumber: string | null;
};

type ProviderWalletRow = {
  provider: { id: string; name: string | null; email: string };
  balanceCredits: number;
  pendingCredits: number;
  paidCredits: number;
  balanceEgp: number;
  pendingEgp: number;
  paidEgp: number;
  requestCount: number;
  ledgerCount: number;
  payout: PayoutDetails | null;
};

type LedgerEntry = {
  id: string;
  totalCredits: number;
  providerCredits: number;
  creditPriceEgp: number;
  totalAmountEgp: number;
  providerAmountEgp: number;
  status: "AVAILABLE" | "PAID" | "VOIDED";
  settledAt: string | Date;
  provider: { name: string | null; email: string };
  request: { title: string };
  serviceType: {
    icon: string | null;
    name: string;
    nameI18n?: Record<string, string> | null;
  };
};

type WithdrawalRow = {
  id: string;
  amountEgp: number;
  amountCredits: number;
  payoutMethod: PayoutMethod;
  accountHolder: string;
  bankName: string | null;
  bankAccount: string | null;
  eWalletNumber: string | null;
  providerNote: string | null;
  status: WithdrawalStatus;
  source: "PROVIDER" | "ADMIN";
  adminReason: string | null;
  createdAt: string | Date;
  provider: { id: string; name: string | null; email: string };
};

function formatCredits(value: number) {
  return value.toLocaleString();
}

function formatEgp(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} EGP`;
}

function formatDestination(entry: {
  payoutMethod: PayoutMethod | null;
  accountHolder: string | null;
  bankName: string | null;
  bankAccount: string | null;
  eWalletNumber: string | null;
}) {
  if (!entry.payoutMethod || !entry.accountHolder) return "—";
  if (entry.payoutMethod === "BANK") {
    return [entry.accountHolder, entry.bankName, entry.bankAccount].filter(Boolean).join(" · ");
  }
  return [entry.accountHolder, entry.eWalletNumber].filter(Boolean).join(" · ");
}

function hasCompletePayout(payout: PayoutDetails | null) {
  if (!payout?.payoutMethod || !payout.accountHolder?.trim()) return false;
  if (payout.payoutMethod === "BANK") {
    return Boolean(payout.bankName?.trim() && payout.bankAccount?.trim());
  }
  return Boolean(payout.eWalletNumber?.trim());
}

function withdrawalBadgeVariant(status: WithdrawalStatus) {
  if (status === "APPROVED") return "default" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "secondary" as const;
}

export default function AdminFinancePage() {
  const t = useTranslations("admin.finance");
  const locale = useLocale();
  const utils = trpc.useUtils();
  const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>();
  const [withdrawalFilter, setWithdrawalFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [reviewTarget, setReviewTarget] = useState<WithdrawalRow | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [payoutTarget, setPayoutTarget] = useState<ProviderWalletRow | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutReason, setPayoutReason] = useState("");

  const { data: finance, isLoading: financeLoading } = trpc.admin.getFinanceOverview.useQuery();
  const { data: ledgerData, isLoading: ledgerLoading } =
    trpc.admin.getProviderFinanceLedger.useQuery({
      providerId: selectedProviderId,
      limit: 50,
    });
  const { data: withdrawalsData, isLoading: withdrawalsLoading } =
    trpc.admin.getWithdrawals.useQuery({
      status: withdrawalFilter === "PENDING" ? "PENDING" : undefined,
      limit: 50,
    });

  const selectedProvider = useMemo(
    () =>
      finance?.providerWallets.find(
        (wallet: { provider: { id: string } }) => wallet.provider.id === selectedProviderId
      ),
    [finance?.providerWallets, selectedProviderId]
  );
  const ledgerEntries = (ledgerData?.ledger ?? []) as LedgerEntry[];
  const withdrawals = (withdrawalsData?.withdrawals ?? []) as WithdrawalRow[];
  const wallets = (finance?.providerWallets ?? []) as ProviderWalletRow[];

  const reviewMutation = trpc.admin.reviewWithdrawal.useMutation({
    onSuccess: (_data, variables) => {
      showSuccess(
        variables.status === "APPROVED" ? t("toast.approved") : t("toast.rejected")
      );
      setReviewTarget(null);
      setReviewReason("");
      utils.admin.getFinanceOverview.invalidate();
      utils.admin.getWithdrawals.invalidate();
    },
    onError: (error) => showError(error),
  });

  const sendPayoutMutation = trpc.admin.sendProviderPayout.useMutation({
    onSuccess: () => {
      showSuccess(t("toast.sent"));
      setPayoutTarget(null);
      setPayoutAmount("");
      setPayoutReason("");
      utils.admin.getFinanceOverview.invalidate();
      utils.admin.getWithdrawals.invalidate();
    },
    onError: (error) => showError(error),
  });

  const summaryCards = [
    {
      title: t("summary.providerAmount"),
      value: formatEgp(finance?.summary.totalProviderAmountEgp ?? 0),
      description: t("summary.providerCreditsDesc"),
      detail: t("summary.creditDetail", {
        credits: finance?.summary.totalProviderCredits ?? 0,
      }),
      icon: Wallet,
    },
    {
      title: t("summary.walletBalance"),
      value: formatEgp(finance?.summary.totalWalletBalanceEgp ?? 0),
      description: t("summary.walletBalanceDesc"),
      detail: t("summary.creditDetail", {
        credits: finance?.summary.totalWalletBalanceCredits ?? 0,
      }),
      icon: CreditCard,
    },
    {
      title: t("pending.title"),
      value: formatCredits(finance?.summary.pendingWithdrawals ?? 0),
      description: t("pending.description"),
      detail: formatEgp(finance?.summary.totalPendingEgp ?? 0),
      icon: Clock,
    },
    {
      title: t("summary.paidOut"),
      value: formatEgp(finance?.summary.totalPaidEgp ?? 0),
      description: t("summary.paidOutDesc"),
      detail: t("summary.creditDetail", {
        credits: finance?.summary.totalPaidCredits ?? 0,
      }),
      icon: CheckCircle,
    },
  ];

  const settleMutation = trpc.admin.settleUnsettledCompletedRequests.useMutation({
    onSuccess: (result) => {
      showSuccess(
        t("ledger.settleSuccess", {
          settled: result.settled,
          skipped: result.skipped,
        })
      );
      utils.admin.getFinanceOverview.invalidate();
      utils.admin.getProviderFinanceLedger.invalidate();
    },
    onError: (error) => showError(error),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {financeLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{card.value}</div>
              )}
              <p className="text-xs text-muted-foreground">{card.description}</p>
              <p className="text-xs text-muted-foreground">{card.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("withdrawals.title")}</CardTitle>
            <CardDescription>{t("withdrawals.description")}</CardDescription>
          </div>
          <Tabs
            value={withdrawalFilter}
            onValueChange={(value) => setWithdrawalFilter(value as "PENDING" | "ALL")}
          >
            <TabsList>
              <TabsTrigger value="PENDING">{t("withdrawals.filterPending")}</TabsTrigger>
              <TabsTrigger value="ALL">{t("withdrawals.filterAll")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {withdrawalsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : null}
          {!withdrawalsLoading && withdrawals.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              {t("withdrawals.empty")}
            </div>
          ) : null}
          {!withdrawalsLoading && withdrawals.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("withdrawals.provider")}</TableHead>
                  <TableHead>{t("withdrawals.amount")}</TableHead>
                  <TableHead>{t("withdrawals.method")}</TableHead>
                  <TableHead>{t("withdrawals.destination")}</TableHead>
                  <TableHead>{t("withdrawals.status")}</TableHead>
                  <TableHead>{t("withdrawals.source")}</TableHead>
                  <TableHead>{t("withdrawals.adminReason")}</TableHead>
                  <TableHead>{t("withdrawals.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium">
                        {entry.provider.name || entry.provider.email}
                      </div>
                      <div className="text-xs text-muted-foreground">{entry.provider.email}</div>
                    </TableCell>
                    <TableCell>{formatEgp(entry.amountEgp)}</TableCell>
                    <TableCell>{t(`methods.${entry.payoutMethod}`)}</TableCell>
                    <TableCell className="max-w-xs text-sm">
                      {formatDestination(entry)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={withdrawalBadgeVariant(entry.status)}>
                        {t(`withdrawStatus.${entry.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.source === "ADMIN"
                        ? t("withdrawals.sourceAdmin")
                        : t("withdrawals.sourceProvider")}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {entry.adminReason || entry.providerNote || "—"}
                    </TableCell>
                    <TableCell>
                      {entry.status === "PENDING" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setReviewTarget(entry);
                            setReviewReason("");
                          }}
                        >
                          {t("withdrawals.review")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("wallets.title")}</CardTitle>
          <CardDescription>{t("wallets.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {financeLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("wallets.provider")}</TableHead>
                  <TableHead>{t("withdrawals.destination")}</TableHead>
                  <TableHead>{t("wallets.balanceEgp")}</TableHead>
                  <TableHead>{t("wallets.pendingEgp")}</TableHead>
                  <TableHead>{t("wallets.paidEgp")}</TableHead>
                  <TableHead>{t("wallets.requests")}</TableHead>
                  <TableHead>{t("wallets.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((wallet) => (
                  <TableRow key={wallet.provider.id}>
                    <TableCell>
                      <div className="font-medium">
                        {wallet.provider.name || wallet.provider.email}
                      </div>
                      <div className="text-xs text-muted-foreground">{wallet.provider.email}</div>
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">
                      {formatDestination(wallet.payout ?? { payoutMethod: null, accountHolder: null, bankName: null, bankAccount: null, eWalletNumber: null })}
                    </TableCell>
                    <TableCell>{formatEgp(wallet.balanceEgp)}</TableCell>
                    <TableCell>{formatEgp(wallet.pendingEgp)}</TableCell>
                    <TableCell>{formatEgp(wallet.paidEgp)}</TableCell>
                    <TableCell>{wallet.requestCount}</TableCell>
                    <TableCell className="flex flex-wrap gap-2">
                      <Button
                        variant={
                          selectedProviderId === wallet.provider.id ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          setSelectedProviderId(
                            selectedProviderId === wallet.provider.id
                              ? undefined
                              : wallet.provider.id
                          )
                        }
                      >
                        {selectedProviderId === wallet.provider.id
                          ? t("wallets.showAll")
                          : t("wallets.viewLedger")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPayoutTarget(wallet);
                          setPayoutAmount(
                            wallet.balanceEgp > 0 ? String(wallet.balanceEgp) : ""
                          );
                          setPayoutReason("");
                        }}
                      >
                        {t("payout.send")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t("ledger.title")}</CardTitle>
              <CardDescription>
                {selectedProvider
                  ? t("ledger.filteredBy", {
                      provider: selectedProvider.provider.name || selectedProvider.provider.email,
                    })
                  : t("ledger.description")}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(finance?.summary.unsettledCompletedRequests ?? 0) > 0 && (
                <>
                  <Badge variant="secondary">
                    {t("ledger.unsettled", {
                      count: finance?.summary.unsettledCompletedRequests ?? 0,
                    })}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={settleMutation.isPending}
                    onClick={() => settleMutation.mutate({ limit: 50 })}
                  >
                    {settleMutation.isPending ? t("ledger.settling") : t("ledger.settleNow")}
                  </Button>
                </>
              )}
              <Badge variant="outline">
                {t("summary.settledRequests")}: {finance?.summary.totalSettledRequests ?? 0}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ledgerLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ledger.provider")}</TableHead>
                  <TableHead>{t("ledger.request")}</TableHead>
                  <TableHead>{t("ledger.service")}</TableHead>
                  <TableHead>{t("ledger.total")}</TableHead>
                  <TableHead>{t("ledger.creditPrice")}</TableHead>
                  <TableHead>{t("ledger.providerCredits")}</TableHead>
                  <TableHead>{t("ledger.providerAmount")}</TableHead>
                  <TableHead>{t("ledger.status")}</TableHead>
                  <TableHead>{t("ledger.settledAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.provider.name || entry.provider.email}</TableCell>
                    <TableCell>{entry.request.title}</TableCell>
                    <TableCell>
                      {entry.serviceType.icon}{" "}
                      {resolveLocalizedText(
                        entry.serviceType.nameI18n,
                        locale,
                        entry.serviceType.name
                      )}
                    </TableCell>
                    <TableCell>{formatCredits(entry.totalCredits)}</TableCell>
                    <TableCell>{formatEgp(entry.creditPriceEgp)}</TableCell>
                    <TableCell>{formatCredits(entry.providerCredits)}</TableCell>
                    <TableCell>{formatEgp(entry.providerAmountEgp)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t("status.AVAILABLE")}</Badge>
                    </TableCell>
                    <TableCell>{new Date(entry.settledAt).toLocaleDateString(locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(reviewTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setReviewTarget(null);
            setReviewReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("review.title")}</DialogTitle>
            <DialogDescription>{t("review.description")}</DialogDescription>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">{reviewTarget.provider.name || reviewTarget.provider.email}</span>
                {" · "}
                {formatEgp(reviewTarget.amountEgp)}
              </p>
              <p className="text-muted-foreground">{formatDestination(reviewTarget)}</p>
              {reviewTarget.providerNote && (
                <p>
                  {t("withdrawals.providerNote")}: {reviewTarget.providerNote}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="reviewReason">{t("review.reason")}</Label>
                <Textarea
                  id="reviewReason"
                  value={reviewReason}
                  onChange={(event) => setReviewReason(event.target.value)}
                  placeholder={t("review.reasonPlaceholder")}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              disabled={reviewMutation.isPending || reviewReason.trim().length < 5}
              onClick={() => {
                if (!reviewTarget) return;
                reviewMutation.mutate({
                  withdrawalId: reviewTarget.id,
                  status: "REJECTED",
                  reason: reviewReason,
                });
              }}
            >
              {reviewMutation.isPending ? t("review.submitting") : t("review.reject")}
            </Button>
            <Button
              disabled={reviewMutation.isPending || reviewReason.trim().length < 5}
              onClick={() => {
                if (!reviewTarget) return;
                reviewMutation.mutate({
                  withdrawalId: reviewTarget.id,
                  status: "APPROVED",
                  reason: reviewReason,
                });
              }}
            >
              {reviewMutation.isPending ? t("review.submitting") : t("review.approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(payoutTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setPayoutTarget(null);
            setPayoutAmount("");
            setPayoutReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("payout.title")}</DialogTitle>
            <DialogDescription>{t("payout.description")}</DialogDescription>
          </DialogHeader>
          {payoutTarget && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {payoutTarget.provider.name || payoutTarget.provider.email}
              </p>
              {hasCompletePayout(payoutTarget.payout) && payoutTarget.payout ? (
                <p className="text-sm text-muted-foreground">
                  {formatDestination(payoutTarget.payout)}
                </p>
              ) : (
                <Alert variant="warning">
                  <AlertDescription>{t("payout.noDetails")}</AlertDescription>
                </Alert>
              )}
              {payoutTarget.balanceEgp < 1 && (
                <Alert variant="warning">
                  <AlertDescription>{t("payout.noBalance")}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="payoutAmount">{t("payout.amount")}</Label>
                <Input
                  id="payoutAmount"
                  type="number"
                  min="1"
                  step="0.01"
                  max={payoutTarget.balanceEgp}
                  value={payoutAmount}
                  onChange={(event) => setPayoutAmount(event.target.value)}
                  disabled={!hasCompletePayout(payoutTarget.payout) || payoutTarget.balanceEgp < 1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payoutReason">{t("payout.reason")}</Label>
                <Textarea
                  id="payoutReason"
                  value={payoutReason}
                  onChange={(event) => setPayoutReason(event.target.value)}
                  placeholder={t("payout.reasonPlaceholder")}
                  disabled={!hasCompletePayout(payoutTarget.payout) || payoutTarget.balanceEgp < 1}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={
                sendPayoutMutation.isPending ||
                !payoutTarget ||
                !hasCompletePayout(payoutTarget.payout) ||
                payoutTarget.balanceEgp < 1 ||
                payoutReason.trim().length < 5 ||
                Number(payoutAmount) < 1
              }
              onClick={() => {
                if (!payoutTarget) return;
                sendPayoutMutation.mutate({
                  providerId: payoutTarget.provider.id,
                  amountEgp: Number(payoutAmount),
                  reason: payoutReason,
                });
              }}
            >
              {sendPayoutMutation.isPending ? t("payout.submitting") : t("payout.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
