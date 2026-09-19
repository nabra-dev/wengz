"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import { showError, showSuccess } from "@/lib/error-handler";

export default function AdminSettingsPage() {
  const tAdmin = useTranslations("admin");
  const t = useTranslations("admin.dashboard.maintenance");
  const tFinance = useTranslations("admin.settings.finance");
  const { data: maintenance, isLoading: maintenanceLoading } =
    trpc.admin.getMaintenanceMode.useQuery();
  const { data: financeSettings, isLoading: financeLoading } =
    trpc.admin.getFinanceSettings.useQuery();
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

  const [creditPriceUsd, setCreditPriceUsd] = useState("1");
  const [commissionPercent, setCommissionPercent] = useState("10");

  useEffect(() => {
    if (!financeSettings) return;
    setCreditPriceUsd(String(financeSettings.creditPriceUsd));
    setCommissionPercent(String(financeSettings.commissionPercent));
  }, [financeSettings]);

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
    </div>
  );
}
