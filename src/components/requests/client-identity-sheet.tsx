"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { History, FileIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "@/components/ui/audio-player";
import { FileDownloadButton, FilePreviewWithDownload } from "@/components/ui/file-download-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OffsetPagination } from "@/components/ui/offset-pagination";
import { trpc } from "@/lib/trpc/client";
import { resolveLocalizedText } from "@/lib/i18n";
import { formatDateTime } from "@/lib/utils";
import type { LocalizedText } from "@/types/i18n";

interface ClientIdentitySheetProps {
  readonly clientId: string;
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

export function ClientIdentitySheet({ clientId }: ClientIdentitySheetProps) {
  const t = useTranslations("requests.clientIdentity");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const sheetSide = locale === "ar" ? "left" : "right";
  const offset = (page - 1) * pageSize;

  const { data, isLoading, isFetching } = trpc.request.getClientIdentity.useQuery(
    { clientId, limit: pageSize, offset },
    { enabled: open && Boolean(clientId) }
  );

  const items = useMemo(() => (data?.items ?? []) as IdentityAsset[], [data?.items]);

  useEffect(() => {
    if (!open) {
      setPage(1);
      setPageSize(10);
    }
  }, [open]);

  const total = data?.total ?? items.length;
  const hasMore = data?.hasMore ?? false;

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
          <SheetDescription>{t("description")}</SheetDescription>
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
                      <div
                        key={asset.id}
                        className="group rounded border bg-card p-2 transition-colors hover:bg-muted/50"
                      >
                        <FilePreviewWithDownload url={file} filename={displayName} className="mb-1">
                          <a
                            href={file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <div className="mb-0 flex aspect-video items-center justify-center overflow-hidden rounded bg-muted">
                              <img
                                src={file}
                                alt={displayName}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          </a>
                        </FilePreviewWithDownload>
                        <div className="flex items-center gap-1">
                          <p className="min-w-0 flex-1 truncate text-xs">{displayName}</p>
                          <FileDownloadButton
                            url={file}
                            filename={displayName}
                            variant="icon"
                            className="h-7 w-7"
                          />
                        </div>
                        {completedLabel ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {completedLabel}
                          </p>
                        ) : null}
                      </div>
                    );
                  }

                  if (isAudio(file)) {
                    return (
                      <div
                        key={asset.id}
                        className="relative col-span-2 space-y-1 rounded border bg-card p-2 pe-10"
                      >
                        <FileDownloadButton
                          url={file}
                          filename={displayName}
                          className="top-2 end-2"
                        />
                        <AudioPlayer src={file} className="w-full" filename={displayName} />
                        <p className="truncate text-xs">{displayName}</p>
                        {completedLabel ? (
                          <p className="text-[10px] text-muted-foreground">{completedLabel}</p>
                        ) : null}
                      </div>
                    );
                  }

                  if (isVideo(file)) {
                    return (
                      <div key={asset.id} className="rounded border bg-card p-2">
                        <FilePreviewWithDownload url={file} filename={displayName} className="mb-1">
                          <div className="aspect-video overflow-hidden rounded bg-muted">
                            <video
                              src={file}
                              controls
                              className="h-full w-full object-cover"
                              title={displayName}
                            >
                              <track kind="captions" />
                            </video>
                          </div>
                        </FilePreviewWithDownload>
                        <div className="flex items-center gap-1">
                          <p className="min-w-0 flex-1 truncate text-xs">{displayName}</p>
                          <FileDownloadButton
                            url={file}
                            filename={displayName}
                            variant="icon"
                            className="h-7 w-7"
                          />
                        </div>
                        {completedLabel ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {completedLabel}
                          </p>
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={asset.id}
                      className="relative flex flex-col items-center justify-center rounded border bg-card p-3"
                    >
                      <a
                        href={file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full flex-col items-center justify-center transition-colors hover:opacity-90"
                      >
                        <FileIcon className="mb-1 h-6 w-6 text-muted-foreground" />
                        <p className="w-full truncate text-center text-xs">{displayName}</p>
                        {completedLabel ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {completedLabel}
                          </p>
                        ) : null}
                      </a>
                      <FileDownloadButton
                        url={file}
                        filename={displayName}
                        className="top-1.5 end-1.5"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <OffsetPagination
            page={page}
            pageSize={pageSize}
            total={total}
            hasMore={hasMore}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            isFetching={isFetching}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
