"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import { formatDate } from "@/lib/utils";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import { Check, CreditCard, AlertCircle } from "lucide-react";
import { showError, showSuccess } from "@/lib/error-handler";

type ConfirmDialogState = { type: "upgrade"; packageId: string } | { type: "cancel" } | null;

export default function SubscriptionPage() {
  const t = useTranslations("client.subscription");
  const locale = useLocale();
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);

  const { data: subscription, isLoading: subLoading } = trpc.subscription.getActive.useQuery();
  const { data: packages, isLoading: pkgLoading } = trpc.package.getAll.useQuery();
  const { data: usageStats } = trpc.subscription.getUsageStats.useQuery();

  const subscribeMutation = trpc.subscription.subscribe.useMutation({
    onSuccess: () => {
      utils.subscription.getActive.invalidate();
      utils.subscription.getUsageStats.invalidate();
      utils.subscription.getPending.invalidate();
      showSuccess(t("toast.subscribed"));
      setConfirmDialog(null);
      router.push("/client/payment");
    },
    onError: (error) => {
      showError(error);
    },
  });

  const cancelMutation = trpc.subscription.cancel.useMutation({
    onSuccess: () => {
      utils.subscription.getActive.invalidate();
      utils.subscription.getPending.invalidate();
      showSuccess(t("toast.cancelled"));
      setConfirmDialog(null);
    },
    onError: (error) => {
      showError(error);
    },
  });

  const isLoading = subLoading || pkgLoading;

  const handleSubscribe = (packageId: string, isUpgrade: boolean) => {
    if (isUpgrade) {
      setConfirmDialog({ type: "upgrade", packageId });
      return;
    }
    subscribeMutation.mutate({ packageId });
  };

  const handleCancel = () => {
    if (!subscription) return;
    setConfirmDialog({ type: "cancel" });
  };

  const confirmAction = () => {
    if (!confirmDialog) return;
    if (confirmDialog.type === "upgrade") {
      subscribeMutation.mutate({ packageId: confirmDialog.packageId });
      return;
    }
    if (subscription) {
      cancelMutation.mutate({ subscriptionId: subscription.id });
    }
  };

  const dialogBusy = subscribeMutation.isPending || cancelMutation.isPending;

  return (
    <div className="space-y-8">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />

      {/* Current Subscription */}
      {isLoading && <Skeleton className="h-48 w-full" />}
      {!isLoading && subscription && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-xl sm:text-2xl">
                  {t("currentSubscription.title", {
                    name: (subscription.package as any).nameI18n
                      ? (subscription.package as any).nameI18n[locale] || subscription.package.name
                      : subscription.package.name,
                  })}
                </CardTitle>
                <CardDescription>{t("currentSubscription.description")}</CardDescription>
              </div>
              <Badge variant="default" className="self-start shrink-0">
                {t("currentSubscription.active")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("currentSubscription.creditsRemaining")}
                </p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                  {subscription.remainingCredits}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("currentSubscription.ofTotal", { total: subscription.package.credits })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("currentSubscription.daysRemaining")}
                </p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                  {subscription.daysRemaining}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("currentSubscription.expires", {
                    date: formatDate(subscription.endDate, locale),
                  })}
                </p>
              </div>
            </div>

            {subscription.isExpiring && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {t("currentSubscription.expiringWarning", { days: subscription.daysRemaining })}
                </span>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="destructive" onClick={handleCancel} className="w-full sm:w-auto">
              {t("currentSubscription.cancelSubscription")}
            </Button>
          </CardFooter>
        </Card>
      )}
      {!isLoading && !subscription && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary">{t("noSubscription.title")}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {t("noSubscription.description")}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Available Plans */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold mb-4">
          {subscription ? t("plans.upgrade") : t("plans.choose")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-96" />)}
          {!isLoading && (!packages || packages.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">{t("plans.noPlans")}</p>
              <p className="text-sm">{t("plans.noPlansDesc")}</p>
            </div>
          )}
          {!isLoading &&
            packages &&
            packages.length > 0 &&
            packages.map((pkg) => {
              const isCurrentPlan = subscription?.package.id === pkg.id;
              const pkgData = pkg as any;
              return (
                <Card
                  key={pkg.id}
                  className={`flex flex-col ${isCurrentPlan ? "border-primary" : ""}`}
                >
                  <CardHeader>
                    <div className="space-y-2">
                      {pkgData.isFeatured && (
                        <Badge className="border-0 bg-primary text-primary-foreground">
                          {t("plans.featuredBadge")}
                        </Badge>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle>
                          {pkgData.nameI18n ? pkgData.nameI18n[locale] || pkg.name : pkg.name}
                        </CardTitle>
                        {isCurrentPlan && <Badge variant="secondary">{t("plans.current")}</Badge>}
                      </div>
                    </div>
                    <CardDescription>
                      <span className="text-3xl font-bold text-foreground tabular-nums">
                        {formatCurrency(pkg.price)}
                      </span>
                      <span className="text-muted-foreground">
                        / {pkg.durationDays} {t("info.dayDuration")}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    {(pkgData.descriptionI18n?.[locale] || pkgData.description) && (
                      <p className="mb-4 text-sm text-pretty text-muted-foreground">
                        {pkgData.descriptionI18n?.[locale] || pkgData.description}
                      </p>
                    )}
                    <ul className="space-y-3">
                      <li className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span>
                          {pkg.credits} {t("info.credits")}
                        </span>
                      </li>

                      {pkgData.services && pkgData.services.length > 0 && (
                        <li className="flex flex-col gap-2">
                          <span className="text-sm font-medium">{t("info.servicesIncluded")}:</span>
                          <div className="flex flex-wrap gap-2">
                            {pkgData.services.map((svc: any) => (
                              <Badge key={svc.serviceType.id} variant="outline" className="text-xs">
                                {svc.serviceType.nameI18n
                                  ? svc.serviceType.nameI18n[locale] || svc.serviceType.name
                                  : svc.serviceType.name}
                              </Badge>
                            ))}
                          </div>
                        </li>
                      )}

                      {(pkgData.featuresI18n?.[locale] || pkg.features).map(
                        (feature: string, i: number) => (
                          <li key={`${pkg.id}-feature-${i}`} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </CardContent>
                  <CardFooter className="mt-auto">
                    <Button
                      className="w-full"
                      disabled={isCurrentPlan || subscribeMutation.isPending}
                      onClick={() => handleSubscribe(pkg.id, !!subscription && !isCurrentPlan)}
                    >
                      {(() => {
                        if (subscribeMutation.isPending) return t("plans.processing");
                        if (isCurrentPlan) return t("plans.currentPlan");
                        if (subscription) return t("plans.upgradeCta");
                        return t("plans.subscribe");
                      })()}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          {!isLoading && (
            <Card className="flex flex-col border-dashed border-primary/40">
              <CardHeader>
                <CardTitle>{t("plans.custom.name")}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    {t("plans.custom.priceLabel")}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="mb-4 text-sm text-pretty text-muted-foreground">
                  {t("plans.custom.description")}
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span>{t("plans.custom.creditsLabel")}</span>
                  </li>
                  {(t.raw("plans.custom.features") as string[]).map((feature, i) => (
                    <li key={`custom-plan-feature-${i}`} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/contact">{t("plans.custom.cta")}</Link>
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>

      {/* Usage Stats */}
      {usageStats && (
        <Card>
          <CardHeader>
            <CardTitle>{t("usageStats.title")}</CardTitle>
            <CardDescription>{t("usageStats.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{t("usageStats.totalRequests")}</p>
                <p className="text-2xl font-bold tabular-nums">{usageStats.totalRequests}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{t("usageStats.completed")}</p>
                <p className="text-2xl font-bold tabular-nums">{usageStats.completedRequests}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{t("usageStats.active")}</p>
                <p className="text-2xl font-bold tabular-nums">{usageStats.activeRequests}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{t("usageStats.creditsUsed")}</p>
                <p className="text-2xl font-bold tabular-nums">{usageStats.creditsUsed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!confirmDialog}
        onOpenChange={(open) => {
          if (!open && !dialogBusy) setConfirmDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === "cancel"
                ? t("confirmations.cancelTitle")
                : t("confirmations.upgradeTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === "cancel"
                ? t("confirmations.cancel")
                : t("confirmations.upgrade")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog(null)}
              disabled={dialogBusy}
              className="w-full sm:w-auto"
            >
              {t("confirmations.dismiss")}
            </Button>
            <Button
              variant={confirmDialog?.type === "cancel" ? "destructive" : "default"}
              onClick={confirmAction}
              disabled={dialogBusy}
              className="w-full sm:w-auto"
            >
              {dialogBusy ? t("plans.processing") : t("confirmations.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
