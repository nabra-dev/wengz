"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, getInitials } from "@/lib/utils";
import { ExternalLink, FileText, Link2, Mail, Phone, UserRound } from "lucide-react";

type ServiceType = { id: string; name: string; nameI18n?: Record<string, string> };

type ProviderDetailsUser = {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  image: string | null;
  createdAt: Date;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  providerProfile: {
    bio?: string | null;
    portfolio?: string | null;
    cvUrl?: string | null;
    skillsTags?: string[];
    supportedServices: ServiceType[];
  } | null;
};

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

export function ProviderDetailsDialog({ user }: { user: ProviderDetailsUser }): JSX.Element {
  const t = useTranslations("admin.users");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const profile = user.providerProfile;
  const services = profile?.supportedServices ?? [];
  const skills = profile?.skillsTags ?? [];
  const approvalStatus = user.approvalStatus ?? "APPROVED";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-1">
          <UserRound className="h-4 w-4" />
          {t("providerDetails.open")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("providerDetails.title")}</DialogTitle>
          <DialogDescription>{t("providerDetails.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-1">
          <div className="flex items-start gap-3">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarImage src={user.image || ""} className="object-cover" />
              <AvatarFallback className="text-lg">
                {getInitials(user.name || user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <p className="truncate text-lg font-semibold">
                {user.name || t("providerDetails.noName")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Badge>{tCommon("roles.PROVIDER")}</Badge>
                {approvalStatus === "PENDING" && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/50 text-amber-600 dark:text-amber-400"
                  >
                    {t("badges.pending")}
                  </Badge>
                )}
                {approvalStatus === "REJECTED" && (
                  <Badge variant="destructive">{t("badges.rejected")}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("table.joined")} {formatDate(user.createdAt, locale)}
              </p>
            </div>
          </div>

          <DetailSection title={t("providerDetails.contact")}>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 break-all">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={`mailto:${user.email}`} className="hover:underline">
                  {user.email}
                </a>
              </li>
              {user.phone ? (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span dir="ltr">{user.phone}</span>
                </li>
              ) : (
                <li className="text-muted-foreground">{t("providerDetails.noPhone")}</li>
              )}
            </ul>
          </DetailSection>

          <DetailSection title={t("table.services")}>
            {services.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {services.map((service) => (
                  <Badge key={service.id} variant="outline" className="text-xs">
                    {service.nameI18n?.[locale] || service.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {t("servicesBadge.noServices")}
              </p>
            )}
          </DetailSection>

          {skills.length > 0 ? (
            <DetailSection title={t("table.skills")}>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </DetailSection>
          ) : null}

          <DetailSection title={t("providerDetails.links")}>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="mb-0.5 text-xs text-muted-foreground">{t("table.portfolio")}</p>
                  {profile?.portfolio ? (
                    <a
                      href={profile.portfolio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all font-medium text-[#690DD4] underline-offset-2 hover:underline"
                    >
                      {profile.portfolio}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : (
                    <p className="text-muted-foreground">{t("providerDetails.noPortfolio")}</p>
                  )}
                </div>
              </li>
              <li className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="mb-0.5 text-xs text-muted-foreground">{t("table.cv")}</p>
                  {profile?.cvUrl ? (
                    <a
                      href={profile.cvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-[#690DD4] underline-offset-2 hover:underline"
                    >
                      {t("table.viewCv")}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : (
                    <p className="text-muted-foreground">{t("providerDetails.noCv")}</p>
                  )}
                </div>
              </li>
            </ul>
          </DetailSection>

          <DetailSection title={t("providerDetails.message")}>
            {profile?.bio ? (
              <p className="whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/40 p-3 text-sm leading-7">
                {profile.bio}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("providerDetails.noMessage")}</p>
            )}
          </DetailSection>

          {user.rejectionReason ? (
            <DetailSection title={t("table.rejectionReason")}>
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {user.rejectionReason}
              </p>
            </DetailSection>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
