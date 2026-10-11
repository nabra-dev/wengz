"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/routing";

type UseListPageOptions = {
  /** Query param name (default: `page`) */
  param?: string;
  pageSize?: number;
  /** When true, omit `page=1` from the URL */
  omitDefault?: boolean;
};

/**
 * Syncs 1-based list page with a URL query param (e.g. `?page=2`).
 */
export function useListPage(options: UseListPageOptions = {}) {
  const { param = "page", pageSize = 50, omitDefault = true } = options;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const page = useMemo(() => {
    const raw = searchParams?.get(param);
    const parsed = raw ? Number.parseInt(raw, 10) : 1;
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return parsed;
  }, [param, searchParams]);

  const offset = (page - 1) * pageSize;

  const setPage = useCallback(
    (nextPage: number) => {
      const safe = Math.max(1, Math.floor(nextPage));
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (omitDefault && safe <= 1) {
        params.delete(param);
      } else {
        params.set(param, String(safe));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [omitDefault, param, pathname, router, searchParams]
  );

  const resetPage = useCallback(() => {
    setPage(1);
  }, [setPage]);

  return {
    page,
    offset,
    pageSize,
    setPage,
    resetPage,
  };
}
