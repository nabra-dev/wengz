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
import { useFormatCurrency } from "@/hooks/use-format-currency";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { PAYMENT_PROOF_MAX_MB } from "@/lib/upload-limits";
import { CheckCircle, Clock, CreditCard, Hourglass, Percent, Wallet } from "lucide-react";

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
  heldCredits: number;
  pendingCredits: number;
  paidCredits: number;
  balanceUsd: number;
  heldUsd: number;
  pendingUsd: number;
  paidUsd: number;
  requestCount: number;
  ledgerCount: number;
  payout: PayoutDetails | null;
};

type LedgerEntry = {
  id: string;
  totalCredits: number;
  providerCredits: number;
  platformCredits: number;
  creditPriceUsd: number;
  commissionPercent: number;
  totalAmountUsd: number;
  platformAmountUsd: number;
  providerAmountUsd: number;
  status: "HOLD" | "AVAILABLE" | "PAID" | "VOIDED";
  settledAt: string | Date;
  availableAt?: string | Date | null;
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
  amountUsd: number;
  amountCredits: number;
  feeUsd?: number;
  payoutMethod: PayoutMethod;
  accountHolder: string;
  bankName: string | null;
  bankAccount: string | null;
  eWalletNumber: string | null;
  providerNote: string | null;
  status: WithdrawalStatus;
  source: "PROVIDER" | "ADMIN";
  adminReason: string | null;
  reviewImage: string | null;
  createdAt: string | Date;
  provider: { id: string; name: string | null; email: string };
};

type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";

type FinanceDisputeRow = {
  id: string;
  reason: string;
  status: DisputeStatus;
  adminNote: string | null;
  createdAt: string | Date;
  provider: { id: string; name: string | null; email: string };
  ledger: {
    id: string;
    providerAmountUsd: number;
    status: string;
    request: { id: string; title: string };
  } | null;
  withdrawal: {
    id: string;
    amountUsd: number;
    status: string;
  } | null;
};

function formatCredits(value: number) {
  return value.toLocaleString();
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
  const formatCurrency = useFormatCurrency();
  const utils = trpc.useUtils();
  const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>();
  const [withdrawalFilter, setWithdrawalFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [disputeFilter, setDisputeFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [reviewTarget, setReviewTarget] = useState<WithdrawalRow | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewImageUrl, setReviewImageUrl] = useState<string | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<FinanceDisputeRow | null>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [payoutTarget, setPayoutTarget] = useState<ProviderWalletRow | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutReason, setPayoutReason] = useState("");

  const { data: finance, isLoading: financeLoading } = trpc.admin.getFinanceOverview.useQuery({
    limit: 100,
  });
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
  const { data: disputesData, isLoading: disputesLoading } = trpc.admin.getFinanceDisputes.useQuery({
    status: disputeFilter === "OPEN" ? undefined : "ALL",
    limit: 50,
  });
  const disputes = useMemo(() => {
    const rows = (disputesData?.disputes ?? []) as FinanceDisputeRow[];
    if (disputeFilter !== "OPEN") return rows;
    return rows.filter((row) => row.status === "OPEN" || row.status === "UNDER_REVIEW");
  }, [disputesData?.disputes, disputeFilter]);

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
      setReviewImageUrl(null);
      utils.admin.getFinanceOverview.invalidate();
      utils.admin.getWithdrawals.invalidate();
    },
    onError: (error) => showError(error),
  });

  const reviewDisputeMutation = trpc.admin.reviewFinanceDispute.useMutation({
    onSuccess: () => {
      showSuccess(t("toast.disputeUpdated"));
      setDisputeTarget(null);
      setDisputeNote("");
      utils.admin.getFinanceDisputes.invalidate();
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
      title: t("summary.grossAmount"),
      value: formatCurrency(finance?.summary.totalRequestAmountUsd ?? 0),
      description: t("summary.grossAmountDesc"),
      detail: t("summary.creditDetail", {
        credits: finance?.summary.totalRequestCredits ?? 0,
      }),
      icon: CreditCard,
    },
    {
      title: t("summary.platformAmount"),
      value: formatCurrency(finance?.summary.totalPlatformAmountUsd ?? 0),
      description: t("summary.platformAmountDesc", {
        percent: finance?.summary.commissionPercent ?? 0,
      }),
      detail: t("summary.creditDetail", {
        credits: finance?.summary.totalPlatformCredits ?? 0,
      }),
      icon: Percent,
    },
    {
      title: t("summary.providerAmount"),
      value: formatCurrency(finance?.summary.totalProviderAmountUsd ?? 0),
      description: t("summary.providerCreditsDesc"),
      detail: t("summary.creditDetail", {
        credits: finance?.summary.totalProviderCredits ?? 0,
      }),
      icon: Wallet,
    },
    {
      title: t("summary.walletBalance"),
      value: formatCurrency(finance?.summary.totalWalletBalanceUsd ?? 0),
      description: t("summary.walletBalanceDesc"),
      detail: t("summary.creditDetail", {
        credits: finance?.summary.totalWalletBalanceCredits ?? 0,
      }),
      icon: CreditCard,
    },
    {
      title: t("summary.held"),
      value: formatCurrency(finance?.summary.totalHeldUsd ?? 0),
      description: t("summary.heldDesc"),
      detail: t("summary.creditDetail", {
        credits: finance?.summary.totalHeldCredits ?? 0,
      }),
      icon: Hourglass,
    },
    {
      title: t("pending.title"),
      value: formatCredits(finance?.summary.pendingWithdrawals ?? 0),
      description: t("pending.description"),
      detail: formatCurrency(finance?.summary.totalPendingUsd ?? 0),
      icon: Clock,
    },
    {
      title: t("summary.paidOut"),
      value: formatCurrency(finance?.summary.totalPaidUsd ?? 0),
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
        {!financeLoading && finance?.summary && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("summary.settingsHint", {
              price: formatCurrency(finance.summary.creditPriceUsd ?? 1),
              percent: finance.summary.commissionPercent ?? 0,
            })}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  <TableHead>{t("withdrawals.fee")}</TableHead>
                  <TableHead>{t("withdrawals.net")}</TableHead>
                  <TableHead>{t("withdrawals.method")}</TableHead>
                  <TableHead>{t("withdrawals.destination")}</TableHead>
                  <TableHead>{t("withdrawals.status")}</TableHead>
                  <TableHead>{t("withdrawals.source")}</TableHead>
                  <TableHead>{t("withdrawals.adminReason")}</TableHead>
                  <TableHead>{t("withdrawals.proof")}</TableHead>
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
                    <TableCell>{formatCurrency(entry.amountUsd)}</TableCell>
                    <TableCell>{formatCurrency(entry.feeUsd ?? 0)}</TableCell>
                    <TableCell>
                      {formatCurrency(entry.amountUsd - (entry.feeUsd ?? 0))}
                    </TableCell>
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
                      {entry.reviewImage ? (
                        <a
                          href={entry.reviewImage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary underline-offset-2 hover:underline"
                        >
                          {t("withdrawals.viewProof")}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.status === "PENDING" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setReviewTarget(entry);
                            setReviewReason("");
                            setReviewImageUrl(null);
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
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("disputes.title")}</CardTitle>
            <CardDescription>{t("disputes.description")}</CardDescription>
          </div>
          <Tabs
            value={disputeFilter}
            onValueChange={(value) => setDisputeFilter(value as "OPEN" | "ALL")}
          >
            <TabsList>
              <TabsTrigger value="OPEN">{t("disputes.filterOpen")}</TabsTrigger>
              <TabsTrigger value="ALL">{t("disputes.filterAll")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {disputesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : null}
          {!disputesLoading && disputes.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              {t("disputes.empty")}
            </div>
          ) : null}
          {!disputesLoading && disputes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("disputes.provider")}</TableHead>
                  <TableHead>{t("disputes.target")}</TableHead>
                  <TableHead>{t("disputes.reason")}</TableHead>
                  <TableHead>{t("disputes.status")}</TableHead>
                  <TableHead>{t("disputes.adminNote")}</TableHead>
                  <TableHead>{t("disputes.requestedAt")}</TableHead>
                  <TableHead>{t("disputes.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((entry) => {
                  const targetLabel = entry.ledger
                    ? t("disputes.ledgerTarget", {
                        title: entry.ledger.request.title,
                        amount: formatCurrency(entry.ledger.providerAmountUsd),
                      })
                    : t("disputes.withdrawalTarget", {
                        amount: formatCurrency(entry.withdrawal?.amountUsd ?? 0),
                      });
                  const canReview =
                    entry.status === "OPEN" || entry.status === "UNDER_REVIEW";
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="font-medium">
                          {entry.provider.name || entry.provider.email}
                        </div>
                        <div className="text-xs text-muted-foreground">{entry.provider.email}</div>
                      </TableCell>
                      <TableCell className="max-w-xs text-sm">{targetLabel}</TableCell>
                      <TableCell className="max-w-sm text-sm text-muted-foreground">
                        {entry.reason}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t(`disputeStatus.${entry.status}`)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        {entry.adminNote || "—"}
                      </TableCell>
                      <TableCell>
                        {new Date(entry.createdAt).toLocaleDateString(locale)}
                      </TableCell>
                      <TableCell>
                        {canReview && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setDisputeTarget(entry);
                              setDisputeNote("");
                            }}
                          >
                            {t("disputes.review")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
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
                  <TableHead>{t("wallets.balanceUsd")}</TableHead>
                  <TableHead>{t("wallets.heldUsd")}</TableHead>
                  <TableHead>{t("wallets.pendingUsd")}</TableHead>
                  <TableHead>{t("wallets.paidUsd")}</TableHead>
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
                    <TableCell>{formatCurrency(wallet.balanceUsd)}</TableCell>
                    <TableCell>{formatCurrency(wallet.heldUsd)}</TableCell>
                    <TableCell>{formatCurrency(wallet.pendingUsd)}</TableCell>
                    <TableCell>{formatCurrency(wallet.paidUsd)}</TableCell>
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
                            wallet.balanceUsd > 0 ? String(wallet.balanceUsd) : ""
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
                  <TableHead>{t("ledger.commission")}</TableHead>
                  <TableHead>{t("ledger.grossAmount")}</TableHead>
                  <TableHead>{t("ledger.platformAmount")}</TableHead>
                  <TableHead>{t("ledger.providerCredits")}</TableHead>
                  <TableHead>{t("ledger.providerAmount")}</TableHead>
                  <TableHead>{t("ledger.status")}</TableHead>
                  <TableHead>{t("ledger.availableAt")}</TableHead>
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
                    <TableCell>{formatCurrency(entry.creditPriceUsd)}</TableCell>
                    <TableCell>{entry.commissionPercent}%</TableCell>
                    <TableCell>{formatCurrency(entry.totalAmountUsd)}</TableCell>
                    <TableCell>
                      {formatCurrency(entry.platformAmountUsd)}
                      <span className="block text-xs text-muted-foreground">
                        {t("summary.creditDetail", { credits: entry.platformCredits })}
                      </span>
                    </TableCell>
                    <TableCell>{formatCredits(entry.providerCredits)}</TableCell>
                    <TableCell>{formatCurrency(entry.providerAmountUsd)}</TableCell>
                    <TableCell>
                      <Badge variant={entry.status === "HOLD" ? "outline" : "secondary"}>
                        {t(`status.${entry.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.status === "HOLD" && entry.availableAt
                        ? new Date(entry.availableAt).toLocaleDateString(locale)
                        : "—"}
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
            setReviewImageUrl(null);
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
                {formatCurrency(reviewTarget.amountUsd)}
                {(reviewTarget.feeUsd ?? 0) > 0 && (
                  <>
                    {" · "}
                    {t("withdrawals.fee")}: {formatCurrency(reviewTarget.feeUsd ?? 0)}
                    {" · "}
                    {t("withdrawals.net")}:{" "}
                    {formatCurrency(reviewTarget.amountUsd - (reviewTarget.feeUsd ?? 0))}
                  </>
                )}
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
              <div className="space-y-2">
                <Label>{t("review.image")}</Label>
                <FileUpload
                  key={reviewTarget.id}
                  onFilesChange={(files: UploadedFile[]) => {
                    setReviewImageUrl(files[0]?.url ?? null);
                  }}
                  maxFiles={1}
                  maxSizeMB={PAYMENT_PROOF_MAX_MB}
                  accept="image/*"
                  disabled={reviewMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">{t("review.imageHint")}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              disabled={
                reviewMutation.isPending ||
                !reviewReason.trim() ||
                !reviewImageUrl
              }
              onClick={() => {
                if (!reviewTarget || !reviewImageUrl) return;
                reviewMutation.mutate({
                  withdrawalId: reviewTarget.id,
                  status: "REJECTED",
                  reason: reviewReason,
                  reviewImage: reviewImageUrl,
                });
              }}
            >
              {reviewMutation.isPending ? t("review.submitting") : t("review.reject")}
            </Button>
            <Button
              disabled={
                reviewMutation.isPending ||
                !reviewReason.trim() ||
                !reviewImageUrl
              }
              onClick={() => {
                if (!reviewTarget || !reviewImageUrl) return;
                reviewMutation.mutate({
                  withdrawalId: reviewTarget.id,
                  status: "APPROVED",
                  reason: reviewReason,
                  reviewImage: reviewImageUrl,
                });
              }}
            >
              {reviewMutation.isPending ? t("review.submitting") : t("review.approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(disputeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDisputeTarget(null);
            setDisputeNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("disputes.reviewTitle")}</DialogTitle>
            <DialogDescription>{t("disputes.reviewDescription")}</DialogDescription>
          </DialogHeader>
          {disputeTarget && (
            <div className="space-y-3 text-sm">
              <p className="font-medium">
                {disputeTarget.provider.name || disputeTarget.provider.email}
              </p>
              <p className="text-muted-foreground">{disputeTarget.reason}</p>
              <div className="space-y-2">
                <Label htmlFor="disputeNote">{t("disputes.note")}</Label>
                <Textarea
                  id="disputeNote"
                  value={disputeNote}
                  onChange={(event) => setDisputeNote(event.target.value)}
                  placeholder={t("disputes.notePlaceholder")}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              disabled={!disputeNote.trim() || reviewDisputeMutation.isPending}
              onClick={() => {
                if (!disputeTarget) return;
                reviewDisputeMutation.mutate({
                  disputeId: disputeTarget.id,
                  status: "UNDER_REVIEW",
                  adminNote: disputeNote,
                });
              }}
            >
              {reviewDisputeMutation.isPending
                ? t("disputes.submitting")
                : t("disputes.markUnderReview")}
            </Button>
            <Button
              disabled={!disputeNote.trim() || reviewDisputeMutation.isPending}
              onClick={() => {
                if (!disputeTarget) return;
                reviewDisputeMutation.mutate({
                  disputeId: disputeTarget.id,
                  status: "RESOLVED",
                  adminNote: disputeNote,
                });
              }}
            >
              {t("disputes.resolve")}
            </Button>
            <Button
              variant="destructive"
              disabled={!disputeNote.trim() || reviewDisputeMutation.isPending}
              onClick={() => {
                if (!disputeTarget) return;
                reviewDisputeMutation.mutate({
                  disputeId: disputeTarget.id,
                  status: "REJECTED",
                  adminNote: disputeNote,
                });
              }}
            >
              {t("disputes.reject")}
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
              {payoutTarget.balanceUsd < 1 && (
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
                  max={payoutTarget.balanceUsd}
                  value={payoutAmount}
                  onChange={(event) => setPayoutAmount(event.target.value)}
                  disabled={!hasCompletePayout(payoutTarget.payout) || payoutTarget.balanceUsd < 1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payoutReason">{t("payout.reason")}</Label>
                <Textarea
                  id="payoutReason"
                  value={payoutReason}
                  onChange={(event) => setPayoutReason(event.target.value)}
                  placeholder={t("payout.reasonPlaceholder")}
                  disabled={!hasCompletePayout(payoutTarget.payout) || payoutTarget.balanceUsd < 1}
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
                payoutTarget.balanceUsd < 1 ||
                !payoutReason.trim() ||
                Number(payoutAmount) < 1
              }
              onClick={() => {
                if (!payoutTarget) return;
                sendPayoutMutation.mutate({
                  providerId: payoutTarget.provider.id,
                  amountUsd: Number(payoutAmount),
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
