import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { getStatusColor, getPriorityColor, formatDate } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";

interface RequestHeaderProps {
  readonly title: string;
  readonly status: string;
  readonly priority: number;
  readonly creditCost: number;
  readonly baseCreditCost?: number;
  readonly attributeCredits?: number;
  readonly priorityCreditCost?: number;
  readonly isRevision?: boolean;
  readonly revisionType?: string | null;
  readonly paidRevisionCost?: number;
  readonly serviceTypeName: string;
  readonly serviceTypeIcon?: string;
  readonly createdAt: Date;
  readonly backUrl: string;
  readonly backLabel?: string;
  readonly actions?: React.ReactNode;
  readonly needsManualApproval?: boolean;
}

interface CreditBreakdownData {
  hasCreditBreakdown: boolean;
  creditBreakdown?: string;
  base: number;
  attrs: number;
  prio: number;
  paidRevisionTotal: number;
  hasPaidRevisions: boolean;
  paidRevisionMultiplier: number;
  canDeriveMultiplier: boolean;
  paidUnit: number;
  showFreeRevision: boolean;
}

function calculateCreditBreakdown(
  creditCost: number,
  baseCreditCost?: number,
  attributeCredits?: number,
  priorityCreditCost?: number,
  paidRevisionCost?: number,
  isRevision?: boolean,
  revisionType?: string | null
): CreditBreakdownData {
  const hasCreditBreakdown = baseCreditCost !== undefined && priorityCreditCost !== undefined;
  const base = baseCreditCost ?? 0;
  let attrs = attributeCredits ?? 0;
  const prio = priorityCreditCost ?? 0;
  const paidUnit = paidRevisionCost ?? 0;
  let paidRevisionTotal = hasCreditBreakdown ? Math.max(0, creditCost - base - attrs - prio) : 0;

  // If this is NOT a revision request, prefer attributing any remainder to attributes.
  // This fixes legacy requests where attributeCredits/priorities were not stored explicitly
  // and avoids showing misleading "revision" costs on initial requests.
  if (!isRevision && attrs === 0 && paidRevisionTotal > 0) {
    attrs = paidRevisionTotal;
    paidRevisionTotal = 0;
  }
  const hasPaidRevisions = paidRevisionTotal > 0;
  const canDeriveMultiplier = paidUnit > 0;
  const paidRevisionMultiplier = canDeriveMultiplier ? Math.floor(paidRevisionTotal / paidUnit) : 0;
  const showFreeRevision = !hasPaidRevisions && isRevision === true && revisionType === "free";

  let creditBreakdown: string | undefined;
  if (hasCreditBreakdown) {
    const parts = [`Base: ${baseCreditCost}`];
    if (attrs > 0) parts.push(`Attributes: ${attrs}`);
    parts.push(`Priority: ${priorityCreditCost}`);
    const revisionInfo = getRevisionInfo(
      hasPaidRevisions,
      canDeriveMultiplier,
      paidRevisionMultiplier,
      paidRevisionTotal,
      paidUnit,
      showFreeRevision
    );
    creditBreakdown = parts.join(" + ") + revisionInfo;
  }

  return {
    hasCreditBreakdown,
    creditBreakdown,
    base,
    attrs,
    prio,
    paidRevisionTotal,
    hasPaidRevisions,
    paidRevisionMultiplier,
    canDeriveMultiplier,
    paidUnit,
    showFreeRevision,
  };
}

function getRevisionInfo(
  hasPaidRevisions: boolean,
  canDeriveMultiplier: boolean,
  paidRevisionMultiplier: number,
  paidRevisionTotal: number,
  paidUnit: number,
  showFreeRevision: boolean
): string {
  if (hasPaidRevisions) {
    const canShowMultiplier =
      canDeriveMultiplier && paidRevisionMultiplier >= 1 && paidRevisionTotal % paidUnit === 0;
    return canShowMultiplier
      ? ` + Revisions: +${paidUnit} x ${paidRevisionMultiplier}`
      : ` + Revisions: +${paidRevisionTotal}`;
  }
  return showFreeRevision ? " + Free Revision" : "";
}

function RevisionCostDisplay({
  canDeriveMultiplier,
  paidRevisionMultiplier,
  paidRevisionTotal,
  paidUnit,
}: {
  readonly canDeriveMultiplier: boolean;
  readonly paidRevisionMultiplier: number;
  readonly paidRevisionTotal: number;
  readonly paidUnit: number;
}) {
  const t = useTranslations("requests.header");
  const canShowMultiplier =
    canDeriveMultiplier && paidRevisionMultiplier >= 1 && paidRevisionTotal % paidUnit === 0;

  if (canShowMultiplier) {
    return (
      <>
        +{paidUnit} {paidUnit === 1 ? t("credit") : t("credits")} x {paidRevisionMultiplier}
      </>
    );
  }

  return (
    <>
      +{paidRevisionTotal} {paidRevisionTotal === 1 ? t("credit") : t("credits")}
    </>
  );
}

export function RequestHeader({
  title,
  status,
  priority,
  creditCost,
  baseCreditCost,
  attributeCredits,
  priorityCreditCost,
  isRevision,
  revisionType,
  paidRevisionCost,
  serviceTypeName,
  serviceTypeIcon,
  createdAt,
  backUrl,
  backLabel = "Back",
  actions,
  needsManualApproval = false,
}: RequestHeaderProps) {
  const t = useTranslations("requests.header");
  const tCommon = useTranslations("common");
  const tCard = useTranslations("requests.card");
  const locale = useLocale();

  const getPriorityKey = (priority: number): "LOW" | "MEDIUM" | "HIGH" => {
    if (priority === 1) return "LOW";
    if (priority === 3) return "HIGH";
    return "MEDIUM";
  };

  const breakdown = calculateCreditBreakdown(
    creditCost,
    baseCreditCost,
    attributeCredits,
    priorityCreditCost,
    paidRevisionCost,
    isRevision,
    revisionType
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <Link href={backUrl}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{title}</h1>
            <Badge variant={null} className={getStatusColor(status)}>
              {tCommon(`requestStatus.${status}` as any)}
            </Badge>
            {needsManualApproval && (
              <Badge
                variant="outline"
                className="border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300"
              >
                {tCard("needsManualApproval")}
              </Badge>
            )}
            {!(priority === 1 && priorityCreditCost === 0) && (
              <Badge variant={null} className={getPriorityColor(priority)}>
                {tCommon(`priority.${getPriorityKey(priority)}` as any)} {t("priority")}
              </Badge>
            )}
            <Badge variant="outline" className="font-semibold" title={breakdown.creditBreakdown}>
              💳 {creditCost} {creditCost === 1 ? t("credit") : t("credits")}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {serviceTypeIcon && `${serviceTypeIcon} `}
            {serviceTypeName} • {t("created")} {formatDate(createdAt, locale)}
          </p>
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>

      {/* Credit Cost Breakdown */}
      {breakdown.hasCreditBreakdown && (
        <div className="p-4 bg-muted/50 rounded-lg border">
          <h3 className="font-semibold mb-2 text-sm">{t("creditBreakdown")}</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("baseCost")}</span>
              <span className="font-medium">
                {breakdown.base} {breakdown.base === 1 ? t("credit") : t("credits")}
              </span>
            </div>
            {breakdown.prio !== 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("priorityCost", {
                    priority: tCommon(`priority.${getPriorityKey(priority)}` as any),
                  })}
                </span>
                <span className="font-medium">
                  +{breakdown.prio} {breakdown.prio === 1 ? t("credit") : t("credits")}
                </span>
              </div>
            )}
            {breakdown.attrs > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("attributesCost")}</span>
                <span className="font-medium">
                  +{breakdown.attrs} {breakdown.attrs === 1 ? t("credit") : t("credits")}
                </span>
              </div>
            )}
            {breakdown.hasPaidRevisions && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("revisionCost")}</span>
                <span className="font-medium">
                  <RevisionCostDisplay
                    canDeriveMultiplier={breakdown.canDeriveMultiplier}
                    paidRevisionMultiplier={breakdown.paidRevisionMultiplier}
                    paidRevisionTotal={breakdown.paidRevisionTotal}
                    paidUnit={breakdown.paidUnit}
                  />
                </span>
              </div>
            )}
            {breakdown.showFreeRevision && (
              <div className="flex justify-between text-green-600">
                <span>{t("freeRevision")}</span>
                <span className="font-medium">{t("noAdditionalCost")}</span>
              </div>
            )}
            <div className="pt-2 mt-2 border-t flex justify-between font-semibold">
              <span>{t("total")}</span>
              <span>
                {creditCost} {creditCost === 1 ? t("credit") : t("credits")}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
