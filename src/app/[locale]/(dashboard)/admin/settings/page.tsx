"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc/client";
import { showError, showSuccess } from "@/lib/error-handler";

export default function AdminSettingsPage() {
  const tAdmin = useTranslations("admin");
  const t = useTranslations("admin.dashboard.maintenance");
  const tFinance = useTranslations("admin.settings.finance");
  const tPayment = useTranslations("admin.settings.payment");
  const { data: maintenance, isLoading: maintenanceLoading } =
    trpc.admin.getMaintenanceMode.useQuery();
  const { data: financeSettings, isLoading: financeLoading } =
    trpc.admin.getFinanceSettings.useQuery();
  const { data: paymentSettings, isLoading: paymentLoading } =
    trpc.admin.getPaymentSettings.useQuery();
  const utils = trpc.useUtils();
  const setMaintenanceModeMutation = trpc.admin.setMaintenanceMode.useMutation({
    onSuccess: () => {
      utils.admin.getMaintenanceMode.invalidate();
      utils.admin.getPublicAppState.invalidate();
    },
  });
  const setFinanceSettingsMutation = trpc.admin.setFinanceSettings.useMutation({
    onSuccess: () => {
      showSuccess(tFinance("saved"));
      utils.admin.getFinanceSettings.invalidate();
      utils.admin.getFinanceOverview.invalidate();
    },
    onError: (error) => showError(error),
  });
  const setPaymentSettingsMutation = trpc.admin.setPaymentSettings.useMutation({
    onSuccess: () => {
      showSuccess(tPayment("saved"));
      utils.admin.getPaymentSettings.invalidate();
      utils.payment.getPaymentInfo.invalidate();
    },
    onError: (error) => showError(error),
  });

  const [creditPriceUsd, setCreditPriceUsd] = useState("1");
  const [commissionPercent, setCommissionPercent] = useState("10");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [iban, setIban] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [instapayEnabled, setInstapayEnabled] = useState(true);
  const [instapayLink, setInstapayLink] = useState("");

  useEffect(() => {
    if (!financeSettings) return;
    setCreditPriceUsd(String(financeSettings.creditPriceUsd));
    setCommissionPercent(String(financeSettings.commissionPercent));
  }, [financeSettings]);

  useEffect(() => {
    if (!paymentSettings) return;
    setBankName(paymentSettings.bankName);
    setAccountName(paymentSettings.accountName);
    setIban(paymentSettings.iban);
    setSwiftCode(paymentSettings.swiftCode);
    setCurrency(paymentSettings.currency);
    setNote(paymentSettings.note);
    setInstapayEnabled(paymentSettings.instapayEnabled);
    setInstapayLink(paymentSettings.instapayLink);
  }, [paymentSettings]);

  const maintenanceEnabled = maintenance?.enabled ?? false;
  let maintenanceBadgeLabel = t("disabled");
  if (maintenanceLoading) {
    maintenanceBadgeLabel = t("loading");
  } else if (maintenanceEnabled) {
    maintenanceBadgeLabel = t("enabled");
  }

  let maintenanceActionLabel = t("turnOn");
  if (setMaintenanceModeMutation.isPending) {
    maintenanceActionLabel = t("updating");
  } else if (maintenanceEnabled) {
    maintenanceActionLabel = t("turnOff");
  }

  const handleSaveFinance = (event: FormEvent) => {
    event.preventDefault();
    setFinanceSettingsMutation.mutate({
      creditPriceUsd: Number(creditPriceUsd),
      commissionPercent: Number(commissionPercent),
    });
  };

  const handleSavePayment = (event: FormEvent) => {
    event.preventDefault();
    setPaymentSettingsMutation.mutate({
      bankName,
      accountName,
      iban,
      swiftCode,
      currency,
      note,
      instapayEnabled,
      instapayLink,
    });
  };

  const paymentBusy = paymentLoading || setPaymentSettingsMutation.isPending;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{tAdmin("settings.title")}</h1>
        <p className="text-muted-foreground">{tAdmin("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={maintenanceEnabled ? "destructive" : "secondary"}>
              {maintenanceBadgeLabel}
            </Badge>
          </div>
          <Button
            variant={maintenanceEnabled ? "destructive" : "default"}
            onClick={() => setMaintenanceModeMutation.mutate({ enabled: !maintenanceEnabled })}
            disabled={maintenanceLoading || setMaintenanceModeMutation.isPending}
          >
            {maintenanceActionLabel}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tFinance("title")}</CardTitle>
          <CardDescription>{tFinance("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid max-w-xl gap-4 md:grid-cols-2" onSubmit={handleSaveFinance}>
            <div className="space-y-2">
              <Label htmlFor="creditPriceUsd">{tFinance("creditPriceUsd")}</Label>
              <Input
                id="creditPriceUsd"
                type="number"
                min="0"
                step="0.01"
                value={creditPriceUsd}
                onChange={(event) => setCreditPriceUsd(event.target.value)}
                disabled={financeLoading || setFinanceSettingsMutation.isPending}
                required
              />
              <p className="text-xs text-muted-foreground">{tFinance("creditPriceUsdHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commissionPercent">{tFinance("commissionPercent")}</Label>
              <Input
                id="commissionPercent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={commissionPercent}
                onChange={(event) => setCommissionPercent(event.target.value)}
                disabled={financeLoading || setFinanceSettingsMutation.isPending}
                required
              />
              <p className="text-xs text-muted-foreground">{tFinance("commissionPercentHint")}</p>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={financeLoading || setFinanceSettingsMutation.isPending}>
                {setFinanceSettingsMutation.isPending ? tFinance("saving") : tFinance("save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tPayment("title")}</CardTitle>
          <CardDescription>{tPayment("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid max-w-3xl gap-4 md:grid-cols-2" onSubmit={handleSavePayment}>
            <div className="space-y-2">
              <Label htmlFor="bankName">{tPayment("bankName")}</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={paymentBusy}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountName">{tPayment("accountName")}</Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                disabled={paymentBusy}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iban">{tPayment("iban")}</Label>
              <Input
                id="iban"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                disabled={paymentBusy}
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="swiftCode">{tPayment("swiftCode")}</Label>
              <Input
                id="swiftCode"
                value={swiftCode}
                onChange={(e) => setSwiftCode(e.target.value)}
                disabled={paymentBusy}
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">{tPayment("currency")}</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                disabled={paymentBusy}
                required
                maxLength={8}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="note">{tPayment("note")}</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={paymentBusy}
                required
                rows={3}
              />
            </div>

            <div className="md:col-span-2 space-y-4 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="instapayEnabled"
                  checked={instapayEnabled}
                  onCheckedChange={(checked) => setInstapayEnabled(checked === true)}
                  disabled={paymentBusy}
                />
                <div className="space-y-1">
                  <Label htmlFor="instapayEnabled">{tPayment("instapayEnabled")}</Label>
                  <p className="text-xs text-muted-foreground">{tPayment("instapayHint")}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="instapayLink">{tPayment("instapayLink")}</Label>
                <Input
                  id="instapayLink"
                  type="url"
                  placeholder="https://ipn.eg/..."
                  value={instapayLink}
                  onChange={(e) => setInstapayLink(e.target.value)}
                  disabled={paymentBusy || !instapayEnabled}
                  required={instapayEnabled}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={paymentBusy}>
                {setPaymentSettingsMutation.isPending ? tPayment("saving") : tPayment("save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
