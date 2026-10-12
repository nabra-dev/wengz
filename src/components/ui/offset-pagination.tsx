"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LIST_PAGE_SIZES, type ListPageSize } from "@/hooks/use-list-page";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type OffsetPaginationProps = {
  /** 1-based page number */
  page: number;
  pageSize: number;
  total: number;
  hasMore?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: ListPageSize) => void;
  pageSizeOptions?: readonly ListPageSize[];
  isFetching?: boolean;
  className?: string;
};

/**
 * Prev/Next + optional per-page selector for offset+total lists (parent syncs to URL).
 */
export function OffsetPagination({
  page,
  pageSize,
  total,
  hasMore,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = LIST_PAGE_SIZES,
  isFetching = false,
  className,
}: OffsetPaginationProps) {
  const t = useTranslations("common.pagination");

  if (total <= 0) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = hasMore ?? page < pageCount;

  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={
        className ?? "mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <p className="text-sm text-muted-foreground">
        {t("showing", { from, to, total })}
        <span className="ms-2 text-muted-foreground/80">({t("pageOf", { page, pageCount })})</span>
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">{t("perPage")}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value) as ListPageSize)}
              disabled={isFetching}
            >
              <SelectTrigger className="h-9 w-[4.75rem]" aria-label={t("perPage")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={!canPrev || isFetching}
          onClick={() => onPageChange(page - 1)}
        >
          {isFetching && canPrev ? (
            <Loader2 className="me-1 h-4 w-4 animate-spin" />
          ) : (
            <ChevronLeft className="me-1 h-4 w-4" />
          )}
          {t("previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canNext || isFetching}
          onClick={() => onPageChange(page + 1)}
        >
          {t("next")}
          {isFetching && canNext ? (
            <Loader2 className="ms-1 h-4 w-4 animate-spin" />
          ) : (
            <ChevronRight className="ms-1 h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
