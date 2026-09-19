"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { showError, showSuccess } from "@/lib/error-handler";
import { resolveLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc/client";
import { Clock, CreditCard, History, Wallet } from "lucide-react";

type PayoutMethod = "BANK" | "E_WALLET";
type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED";

type WalletLedgerEntry = {
  id: string;
  totalCredits: number;
  providerCredits: number;
  creditPriceUsd: number;
  totalAmountUsd: number;
  providerAmountUsd: number;
  status: "AVAILABLE" | "PAID" | "VOIDED";
  settledAt: string | Date;
  request: {
    title: string;
  };
  serviceType: {
    icon?: string | null;
    name: string;
    nameI18n?: Record<string, string> | null;
  };
};

type WithdrawalEntry = {
  id: string;
  amountUsd: number;
  amountCredits: number;
  payoutMethod: PayoutMethod;
  accountHolder: string;
  bankName: string | null;
  bankAccount: string | null;
  eWalletNumber: string | null;
  providerNote: string | null;
  status: WithdrawalStatus;
  adminReason: string | null;
  createdAt: string | Date;
};

function formatCredits(value: number) {
  return value.toLocaleString();
}

function formatMoney(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDestination(entry: {
  payoutMethod: PayoutMethod;
  accountHolder: string;
  bankName: string | null;
  bankAccount: string | null;
  eWalletNumber: string | null;
}) {
  if (entry.payoutMethod === "BANK") {
    return [entry.accountHolder, entry.bankName, entry.bankAccount].filter(Boolean).join(" · ");
  }

  return [entry.accountHolder, entry.eWalletNumber].filter(Boolean).join(" · ");
}

function hasCompletePayout(payout: {
  payoutMethod: PayoutMethod | null;
  accountHolder: string | null;
  bankName: string | null;
  bankAccount: string | null;
  eWalletNumber: string | null;
} | null) {
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

export default function ProviderWalletPage() {
  const t = useTranslations("provider.walletPage");
  const locale = useLocale();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.provider.getEarnings.useQuery();
  const ledger = (data?.ledger ?? []) as WalletLedgerEntry[];
  const withdrawals = (data?.withdrawals ?? []) as WithdrawalEntry[];

  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("BANK");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [eWalletNumber, setEWalletNumber] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [providerNote, setProviderNote] = useState("");

  useEffect(() => {
    if (!data?.payout) return;
    setPayoutMethod(data.payout.payoutMethod ?? "BANK");
    setAccountHolder(data.payout.accountHolder ?? "");
    setBankName(data.payout.bankName ?? "");
    setBankAccount(data.payout.bankAccount ?? "");
    setEWalletNumber(data.payout.eWalletNumber ?? "");
  }, [data?.payout]);

  const payoutReady = hasCompletePayout(data?.payout ?? null);
  const availableBalance = data?.balanceUsd ?? 0;
  const canRequest =
    payoutReady && availableBalance >= 1 && !data?.hasPendingWithdrawal && !isLoading;

  const updatePayout = trpc.provider.updatePayoutDetails.useMutation({
    onSuccess: () => {
      showSuccess(t("payout.saved"));
      utils.provider.getEarnings.invalidate();
    },
    onError: (error) => showError(error),
  });

  const requestWithdrawal = trpc.provider.requestWithdrawal.useMutation({
    onSuccess: () => {
      showSuccess(t("withdraw.requested"));
      setAmountUsd("");
      setProviderNote("");
      utils.provider.getEarnings.invalidate();
    },
    onError: (error) => showError(error),
  });

  const summaryCards = useMemo(
    () => [
      {
        title: t("summary.balance"),
        value: formatMoney(data?.balanceUsd ?? 0),
        description: t("summary.balanceDesc"),
        detail: t("summary.creditDetail", { credits: data?.balanceCredits ?? 0 }),
        icon: Wallet,
      },
      {
        title: t("summary.pending"),
        value: formatMoney(data?.pendingUsd ?? 0),
        description: t("summary.pendingDesc"),
        detail: t("summary.creditDetail", { credits: data?.pendingCredits ?? 0 }),
        icon: Clock,
      },
      {
        title: t("summary.paid"),
        value: formatMoney(data?.paidUsd ?? 0),
        description: t("summary.paidDesc"),
        detail: t("summary.creditDetail", { credits: data?.paidCredits ?? 0 }),
        icon: History,
      },
      {
        title: t("summary.periodEarnings"),
        value: formatMoney(data?.totalEarningsUsd ?? 0),
        description: t("summary.periodEarningsDesc"),
        detail: t("summary.creditDetail", { credits: data?.totalEarnings ?? 0 }),
        icon: CreditCard,
      },
    ],
    [data, t]
  );

  const renderWithdrawalsContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (withdrawals.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("withdrawals.empty")}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("withdrawals.amount")}</TableHead>
            <TableHead>{t("withdrawals.method")}</TableHead>
            <TableHead>{t("withdrawals.destination")}</TableHead>
            <TableHead>{t("withdrawals.status")}</TableHead>
            <TableHead>{t("withdrawals.reason")}</TableHead>
            <TableHead>{t("withdrawals.requestedAt")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {withdrawals.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{formatMoney(entry.amountUsd)}</TableCell>
              <TableCell>
                {entry.payoutMethod === "BANK" ? t("payout.bank") : t("payout.eWallet")}
              </TableCell>
              <TableCell>{formatDestination(entry)}</TableCell>
              <TableCell>
                <Badge variant={withdrawalBadgeVariant(entry.status)}>
                  {t(`withdrawStatus.${entry.status}`)}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs text-sm text-muted-foreground">
                {entry.adminReason || entry.providerNote || "—"}
              </TableCell>
              <TableCell>{new Date(entry.createdAt).toLocaleDateString(locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderLedgerContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (ledger.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("ledger.empty")}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
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
          {ledger.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.request.title}</TableCell>
              <TableCell>
                {entry.serviceType.icon}{" "}
                {resolveLocalizedText(entry.serviceType.nameI18n, locale, entry.serviceType.name)}
              </TableCell>
              <TableCell>{formatCredits(entry.totalCredits)}</TableCell>
              <TableCell>{formatMoney(entry.creditPriceUsd)}</TableCell>
              <TableCell>{formatCredits(entry.providerCredits)}</TableCell>
              <TableCell>{formatMoney(entry.providerAmountUsd)}</TableCell>
              <TableCell>
                <Badge variant="secondary">{t(`status.${entry.status}`)}</Badge>
              </TableCell>
              <TableCell>{new Date(entry.settledAt).toLocaleDateString(locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

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
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{card.value}</div>
              )}
              <p className="text-xs text-muted-foreground">{card.description}</p>
              {card.detail && <p className="text-xs text-muted-foreground">{card.detail}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("payout.title")}</CardTitle>
            <CardDescription>{t("payout.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                updatePayout.mutate({
                  payoutMethod,
                  accountHolder,
                  bankName: payoutMethod === "BANK" ? bankName : null,
                  bankAccount: payoutMethod === "BANK" ? bankAccount : null,
                  eWalletNumber: payoutMethod === "E_WALLET" ? eWalletNumber : null,
                });
              }}
            >
              <div className="space-y-2">
                <Label>{t("payout.method")}</Label>
                <Select
                  value={payoutMethod}
                  onValueChange={(value) => setPayoutMethod(value as PayoutMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK">{t("payout.bank")}</SelectItem>
                    <SelectItem value="E_WALLET">{t("payout.eWallet")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountHolder">{t("payout.accountHolder")}</Label>
                <Input
                  id="accountHolder"
                  value={accountHolder}
                  onChange={(event) => setAccountHolder(event.target.value)}
                  required
                />
              </div>
              {payoutMethod === "BANK" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bankName">{t("payout.bankName")}</Label>
                    <Input
                      id="bankName"
                      value={bankName}
                      onChange={(event) => setBankName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAccount">{t("payout.bankAccount")}</Label>
                    <Input
                      id="bankAccount"
                      value={bankAccount}
                      onChange={(event) => setBankAccount(event.target.value)}
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="eWalletNumber">{t("payout.eWalletNumber")}</Label>
                  <Input
                    id="eWalletNumber"
                    value={eWalletNumber}
                    onChange={(event) => setEWalletNumber(event.target.value)}
                    required
                  />
                </div>
              )}
              <Button type="submit" disabled={updatePayout.isPending}>
                {updatePayout.isPending ? t("payout.saving") : t("payout.save")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("withdraw.title")}</CardTitle>
            <CardDescription>{t("withdraw.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!payoutReady && <Alert>{t("withdraw.needPayout")}</Alert>}
            {data?.hasPendingWithdrawal && (
              <Alert>
                <AlertDescription>{t("withdraw.pendingExists")}</AlertDescription>
              </Alert>
            )}
            {payoutReady && availableBalance < 1 && !data?.hasPendingWithdrawal && (
              <Alert>{t("withdraw.noBalance")}</Alert>
            )}
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = Number(amountUsd);
                requestWithdrawal.mutate({
                  amountUsd: parsed,
                  providerNote: providerNote.trim() || null,
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="amountUsd">{t("withdraw.amount")}</Label>
                <Input
                  id="amountUsd"
                  type="number"
                  min="1"
                  step="0.01"
                  max={availableBalance}
                  value={amountUsd}
                  onChange={(event) => setAmountUsd(event.target.value)}
                  required
                  disabled={!canRequest}
                />
                <p className="text-xs text-muted-foreground">
                  {t("withdraw.amountHint", { amount: formatMoney(availableBalance) })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="providerNote">{t("withdraw.note")}</Label>
                <Textarea
                  id="providerNote"
                  value={providerNote}
                  onChange={(event) => setProviderNote(event.target.value)}
                  placeholder={t("withdraw.notePlaceholder")}
                  disabled={!canRequest}
                />
              </div>
              <Button type="submit" disabled={!canRequest || requestWithdrawal.isPending}>
                {requestWithdrawal.isPending ? t("withdraw.requesting") : t("withdraw.request")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("withdrawals.title")}</CardTitle>
          <CardDescription>{t("withdrawals.description")}</CardDescription>
        </CardHeader>
        <CardContent>{renderWithdrawalsContent()}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("ledger.title")}</CardTitle>
          <CardDescription>{t("ledger.description")}</CardDescription>
        </CardHeader>
        <CardContent>{renderLedgerContent()}</CardContent>
      </Card>
    </div>
  );
}
