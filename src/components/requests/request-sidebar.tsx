import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";
import { formatDateTime, getInitials } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect } from "react";

interface UserInfo {
  name: string | null;
  email: string | null;
  image: string | null;
}

interface RequestSidebarProps {
  readonly client?: UserInfo;
  readonly provider?: UserInfo | null;
  readonly serviceTypeName: string;
  readonly serviceTypeIcon?: string;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly estimatedDelivery?: Date | null;
  readonly completedAt?: Date | null;
  readonly currentRevisionCount?: number;
  readonly totalRevisions?: number;
  readonly maskProviderNameForClient?: boolean;
  readonly revisionInfo?: {
    freeRevisionsRemaining: number;
    maxFree: number;
    nextRevisionCost: number;
  };
}

function DeliveryCountdown({
  estimatedDelivery,
  t,
  locale,
}: {
  estimatedDelivery: Date;
  t: ReturnType<typeof useTranslations<"requests.sidebar">>;
  locale: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const deliveryMs = new Date(estimatedDelivery).getTime();
  const isFuture = deliveryMs > now;
  const hoursRemaining = Math.max(0, Math.round((deliveryMs - now) / (1000 * 60 * 60)));

  return (
    <div>
      <p className="text-sm text-muted-foreground">{t("estimatedDelivery")}</p>
      <p className="font-medium">{formatDateTime(estimatedDelivery, locale)}</p>
      {isFuture ? (
        <p className="text-xs text-blue-600 mt-1">
          {hoursRemaining < 24
            ? t("hoursRemaining", { hours: hoursRemaining })
            : t("daysRemaining", { days: Math.round(hoursRemaining / 24) })}
        </p>
      ) : (
        <p className="text-xs text-amber-600 mt-1">{t("deliveryTimePassed")}</p>
      )}
    </div>
  );
}

export function RequestSidebar({
  client,
  provider,
  serviceTypeName,
  serviceTypeIcon,
  createdAt,
  updatedAt,
  estimatedDelivery,
  completedAt,
  currentRevisionCount,
  totalRevisions,
  maskProviderNameForClient,
  revisionInfo,
}: RequestSidebarProps) {
  const t = useTranslations("requests.sidebar");
  const locale = useLocale();

  return (
    <div className="space-y-6">
      {/* Client Info */}
      {client && (
        <Card>
          <CardHeader>
            <CardTitle>{t("client")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={client.image || ""} />
                <AvatarFallback>{getInitials(client.name || client.email || "")}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{client.name || t("noName")}</p>
                {client.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider Info */}
      {provider !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>{t("provider")}</CardTitle>
          </CardHeader>
          <CardContent>
            {provider ? (
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src="/images/logo.svg" />
                  <AvatarFallback>{getInitials(t("brandProviderName"))}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {maskProviderNameForClient
                      ? t("brandProviderName")
                      : provider.name || t("noName")}
                  </p>
                  {!maskProviderNameForClient && (
                    <p className="text-sm text-muted-foreground">{provider.email}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>{t("waitingForProvider")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Request Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t("details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("serviceType")}</p>
            <p className="font-medium">
              {serviceTypeIcon && `${serviceTypeIcon} `}
              {serviceTypeName}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("created")}</p>
            <p className="font-medium">{formatDateTime(createdAt, locale)}</p>
          </div>
          {updatedAt && (
            <div>
              <p className="text-muted-foreground text-sm">{t("updated")}</p>
              <p className="font-medium">{formatDateTime(updatedAt, locale)}</p>
            </div>
          )}
              {estimatedDelivery && (
            <DeliveryCountdown estimatedDelivery={estimatedDelivery} t={t} locale={locale} />
          )}
          {completedAt && (
            <div>
              <p className="text-sm text-muted-foreground">{t("completed")}</p>
              <p className="font-medium">{formatDateTime(completedAt, locale)}</p>
            </div>
          )}
          {(currentRevisionCount !== undefined || totalRevisions !== undefined) && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">{t("revisions")}</p>
                <p className="font-medium">
                  {t("totalRequested", { total: totalRevisions || 0 })}
                  {revisionInfo && (
                    <>
                      <br />
                      <span className="text-sm text-muted-foreground">
                        {t("freeUsed", {
                          used: revisionInfo.maxFree - revisionInfo.freeRevisionsRemaining,
                          max: revisionInfo.maxFree,
                        })}
                        {revisionInfo.freeRevisionsRemaining > 0 && (
                          <span className="text-green-600">
                            {" "}
                            {t("freeRemaining", { remaining: revisionInfo.freeRevisionsRemaining })}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
