import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { formatDate, getStatusColor, getPriorityColor } from "@/lib/utils";
import { resolveLocalizedText } from "@/lib/i18n";
import { Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

interface RequestCardProps {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: string;
  readonly priority?: number;
  readonly creditCost: number;
  readonly baseCreditCost?: number;
  readonly priorityCreditCost?: number;
  readonly isRevision?: boolean;
  readonly revisionType?: string | null;
  readonly createdAt: Date;
  readonly serviceType: {
    name: string;
    nameI18n?: Record<string, string> | null;
    icon?: string | null;
  };
  readonly client?: {
    name: string | null;
    email: string;
  };
  readonly provider?: {
    name: string | null;
    email?: string;
  } | null;
  readonly commentCount?: number;
  readonly href: string;
  readonly actions?: React.ReactNode;
  readonly variant?: "compact" | "detailed";
  readonly showProviderAsBrand?: boolean;
  readonly needsManualApproval?: boolean;
}

export function RequestCard({
  id,
  title,
  description,
  status,
  priority,
  creditCost,
  baseCreditCost,
  priorityCreditCost,
  isRevision,
  revisionType,
  createdAt,
  serviceType,
  client,
  provider,
  commentCount,
  href,
  actions,
  variant = "compact",
  showProviderAsBrand = false,
  needsManualApproval = false,
}: RequestCardProps) {
  const tCommon = useTranslations("common");
  const tCard = useTranslations("requests.card");
  const tSidebar = useTranslations("requests.sidebar");
  const locale = useLocale();
  const serviceName = resolveLocalizedText(serviceType.nameI18n, locale, serviceType.name);
  const providerDisplayName = showProviderAsBrand
    ? tSidebar("brandProviderName")
    : provider?.name || provider?.email;

  const getPriorityKey = (priority: number): "LOW" | "MEDIUM" | "HIGH" => {
    if (priority === 1) return "LOW";
    if (priority === 3) return "HIGH";
    return "MEDIUM";
  };

  const hasCreditBreakdown = baseCreditCost !== undefined && priorityCreditCost !== undefined;

  const content = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border hover:bg-muted/50 transition-colors gap-3 sm:gap-4">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <h3 className="font-medium text-sm sm:text-base truncate flex-1 min-w-0">{title}</h3>
          <Badge variant={null} className={`${getStatusColor(status)} text-xs`}>
            {tCommon(`requestStatus.${status}` as any)}
          </Badge>
          {needsManualApproval && (
            <Badge
              variant="outline"
              className="text-xs border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300"
            >
              {tCard("needsManualApproval")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {priority && (
            <Badge variant={null} className={`${getPriorityColor(priority)} text-xs`}>
              {tCommon(`priority.${getPriorityKey(priority)}` as any)}
            </Badge>
          )}
          {creditCost !== undefined && creditCost !== null && (
            <Badge variant="outline" className="font-semibold text-xs flex items-center gap-1">
              💳 {creditCost}
              {hasCreditBreakdown && (
                <span className="text-muted-foreground text-[10px] sm:text-xs">
                  ({baseCreditCost}+{priorityCreditCost})
                </span>
              )}
            </Badge>
          )}
          {isRevision && revisionType && (
            <Badge variant={revisionType === "free" ? "secondary" : "default"} className="text-xs">
              {revisionType === "free"
                ? `🔄 ${tCard("freeRevision")}`
                : `💰 ${tCard("paidRevision")}`}
            </Badge>
          )}
          {provider === null && (
            <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
              {tCard("unassigned")}
            </Badge>
          )}
        </div>

        {variant === "detailed" && description && (
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{description}</p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            {serviceType.icon && `${serviceType.icon} `}
            <span className="truncate">{serviceName}</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            {formatDate(createdAt, locale)}
          </span>
          {client && (
            <span className="truncate">
              <strong>{tCard("client")}:</strong> {client.name || client.email}
            </span>
          )}
          {provider && (
            <span className="truncate">
              <strong>{tCard("provider")}:</strong> {providerDisplayName}
            </span>
          )}
          {commentCount !== undefined && <span>{tCard("messages", { count: commentCount })}</span>}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 sm:ms-4 self-start sm:self-center">{actions}</div>
      )}
    </div>
  );

  if (actions) {
    return <div key={id}>{content}</div>;
  }

  return (
    <Link key={id} href={href} className="block">
      {content}
    </Link>
  );
}
