"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/routing";

export const LIST_PAGE_SIZES = [10, 20, 50, 100] as const;
export type ListPageSize = (typeof LIST_PAGE_SIZES)[number];
export const DEFAULT_LIST_PAGE_SIZE: ListPageSize = 10;

type UseListPageOptions = {
  /** Query param name for the page (default: `page`) */
  param?: string;
  /** Query param name for page size (default: `perPage`) */
  pageSizeParam?: string;
  /** Default page size when param is missing (default: 10) */
  defaultPageSize?: ListPageSize;
  /** When true, omit default page/perPage from the URL */
  omitDefault?: boolean;
};

function parsePage(raw: string | null): number {
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function parsePageSize(raw: string | null, fallback: ListPageSize): ListPageSize {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if ((LIST_PAGE_SIZES as readonly number[]).includes(parsed)) {
    return parsed as ListPageSize;
  }
  return fallback;
}

/**
 * Syncs 1-based list page + page size with URL query params
 * (e.g. `?page=2&perPage=20`).
 */
export function useListPage(options: UseListPageOptions = {}) {
  const {
    param = "page",
    pageSizeParam = "perPage",
    defaultPageSize = DEFAULT_LIST_PAGE_SIZE,
    omitDefault = true,
  } = options;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const page = useMemo(() => parsePage(searchParams?.get(param) ?? null), [param, searchParams]);

  const pageSize = useMemo(
    () => parsePageSize(searchParams?.get(pageSizeParam) ?? null, defaultPageSize),
    [defaultPageSize, pageSizeParam, searchParams]
  );

  const offset = (page - 1) * pageSize;

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setPage = useCallback(
    (nextPage: number) => {
      const safe = Math.max(1, Math.floor(nextPage));
      replaceParams((params) => {
        if (omitDefault && safe <= 1) {
          params.delete(param);
        } else {
          params.set(param, String(safe));
        }
      });
    },
    [omitDefault, param, replaceParams]
  );

  const setPageSize = useCallback(
    (nextSize: number) => {
      const safe = parsePageSize(String(nextSize), defaultPageSize);
      replaceParams((params) => {
        // Changing page size invalidates the current offset — return to page 1.
        if (omitDefault) {
          params.delete(param);
        } else {
          params.set(param, "1");
        }
        if (omitDefault && safe === defaultPageSize) {
          params.delete(pageSizeParam);
        } else {
          params.set(pageSizeParam, String(safe));
        }
      });
    },
    [defaultPageSize, omitDefault, pageSizeParam, param, replaceParams]
  );

  const resetPage = useCallback(() => {
    setPage(1);
  }, [setPage]);

  return {
    page,
    offset,
    pageSize,
    setPage,
    setPageSize,
    resetPage,
  };
}
