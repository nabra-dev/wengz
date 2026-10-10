"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { History, FileIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "@/components/ui/audio-player";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc/client";
import { resolveLocalizedText } from "@/lib/i18n";
import { formatDateTime } from "@/lib/utils";
import type { LocalizedText } from "@/types/i18n";

interface ClientIdentitySheetProps {
  readonly clientId: string;
  readonly clientName?: string | null;
}

type IdentityAsset = {
  id: string;
  fileUrl: string;
  createdAt: Date;
  serviceType: {
    id: string;
    name: string;
    nameI18n: LocalizedText | null;
    icon: string | null;
  };
  sourceRequest: {
    id: string;
    title: string;
    completedAt: Date | null;
  };
};

function isImage(file: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
}

function isAudio(file: string) {
  return /\.(mp3|wav|ogg|m4a|aac)$/i.test(file) || /voice[^/]*\.(webm|mp4|m4a)$/i.test(file);
}

function isVideo(file: string) {
  return (
    /\.(mp4|mov|avi|mkv|mpeg|flv|3gp)$/i.test(file) ||
    (/\.webm$/i.test(file) && !/voice/i.test(file))
  );
}

function getFileNameFromUrl(url: string) {
  const clean = url.split("?")[0];
  const parts = clean.split("/");
  return parts.length > 0 ? parts.pop() || url : url;
}

function prettyFilename(name: string = "") {
  let result = name;
  result = result.replaceAll(/^\d{8,}-/g, "");
  if (result.length > 60 && result.includes("-")) {
    const parts = result.split("-");
    result = parts.slice(1).join("-");
  }
  return result;
}

export function ClientIdentitySheet({ clientId, clientName }: ClientIdentitySheetProps) {
  const t = useTranslations("requests.clientIdentity");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const sheetSide = locale === "ar" ? "left" : "right";

  const { data, isLoading } = trpc.request.getClientIdentity.useQuery(
    { clientId, limit: 48 },
    { enabled: open && Boolean(clientId) }
  );

  const items = useMemo(() => (data?.items ?? []) as IdentityAsset[], [data?.items]);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        serviceTypeId: string;
        serviceName: string;
        serviceIcon: string | null;
        assets: IdentityAsset[];
      }
    >();

    for (const asset of items) {
      const key = asset.serviceType.id;
      const existing = map.get(key);
      const serviceName = resolveLocalizedText(
        asset.serviceType.nameI18n,
        locale,
        asset.serviceType.name
      );
      if (existing) {
        existing.assets.push(asset);
      } else {
        map.set(key, {
          serviceTypeId: key,
          serviceName,
          serviceIcon: asset.serviceType.icon,
          assets: [asset],
        });
      }
    }

    return [...map.values()];
  }, [items, locale]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          {t("button")}
        </Button>
      </SheetTrigger>
      <SheetContent side={sheetSide} className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>
            {clientName ? t("descriptionNamed", { name: clientName }) : t("description")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("empty")}</p>
          )}

          {groups.map((group) => (
            <section key={group.serviceTypeId} className="space-y-3">
              <div className="flex items-center gap-2">
                {group.serviceIcon ? (
                  <span className="text-lg" aria-hidden>
                    {group.serviceIcon}
                  </span>
                ) : null}
                <h3 className="text-sm font-semibold">{group.serviceName}</h3>
                <Badge variant="outline" className="text-xs">
                  {t("assetCount", { count: group.assets.length })}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {group.assets.map((asset) => {
                  const file = asset.fileUrl;
                  const displayName = prettyFilename(getFileNameFromUrl(file));
                  const completedLabel = asset.sourceRequest.completedAt
                    ? formatDateTime(asset.sourceRequest.completedAt, locale)
                    : null;

                  if (isImage(file)) {
                    return (
                      <a
                        key={asset.id}
                        href={file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded border bg-card p-2 hover:bg-muted/50 transition-colors"
                      >
                        <div className="aspect-video rounded overflow-hidden mb-1 bg-muted flex items-center justify-center">
                          <img
                            src={file}
                            alt={displayName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-xs truncate">{displayName}</p>
                        {completedLabel ? (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {completedLabel}
                          </p>
                        ) : null}
                      </a>
                    );
                  }

                  if (isAudio(file)) {
                    return (
                      <div
                        key={asset.id}
                        className="col-span-2 rounded border bg-card p-2 space-y-1"
                      >
                        <AudioPlayer src={file} className="w-full" filename={displayName} />
                        <p className="text-xs truncate">{displayName}</p>
                        {completedLabel ? (
                          <p className="text-[10px] text-muted-foreground">{completedLabel}</p>
                        ) : null}
                      </div>
                    );
                  }

                  if (isVideo(file)) {
                    return (
                      <div key={asset.id} className="rounded border bg-card p-2">
                        <div className="aspect-video rounded overflow-hidden mb-1 bg-muted">
                          <video
                            src={file}
                            controls
                            className="w-full h-full object-cover"
                            title={displayName}
                          >
                            <track kind="captions" />
                          </video>
                        </div>
                        <p className="text-xs truncate">{displayName}</p>
                        {completedLabel ? (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {completedLabel}
                          </p>
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <a
                      key={asset.id}
                      href={file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center rounded border bg-card p-3 hover:bg-muted/50 transition-colors"
                    >
                      <FileIcon className="h-6 w-6 mb-1 text-muted-foreground" />
                      <p className="text-xs truncate text-center w-full">{displayName}</p>
                      {completedLabel ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{completedLabel}</p>
                      ) : null}
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
