"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Loader2, Package } from "lucide-react";
import { useFormatCurrency } from "@/hooks/use-format-currency";

interface PackageItem {
  id: string;
  name: string;
  nameI18n?: Record<string, string>;
  price: number;
  credits: number;
  description?: string;
  descriptionI18n?: Record<string, string>;
  isFeatured?: boolean;
}

type PackagesCarouselProps = {
  packages: PackageItem[];
  isLoading?: boolean;
  isError?: boolean;
};

export function PackagesCarousel({ packages, isLoading, isError }: PackagesCarouselProps) {
  const t = useTranslations("landing.packagesCarousel");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const formatCurrency = useFormatCurrency();
  const isRTL = locale === "ar";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const getLocalized = (text: string | undefined, i18n?: Record<string, string>) =>
    i18n?.[locale] || text || "";

  const updatePagination = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const pages = Math.max(1, Math.ceil(scrollWidth / Math.max(clientWidth, 1)));
    setPageCount(pages);
    if (maxScroll <= 0) {
      setPage(0);
      return;
    }
    const progress = Math.abs(scrollLeft) / maxScroll;
    setPage(Math.min(pages - 1, Math.round(progress * (pages - 1))));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updatePagination();
    el.addEventListener("scroll", updatePagination, { passive: true });
    const ro = new ResizeObserver(updatePagination);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updatePagination);
      ro.disconnect();
    };
  }, [updatePagination]);

  useLayoutEffect(() => {
    updatePagination();
  });

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = el.clientWidth * 0.85 * dir * (isRTL ? -1 : 1);
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section className="relative w-full bg-background px-4 py-12 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="relative">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("loadError")}</p>
          ) : packages.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div
              ref={scrollerRef}
              className="flex gap-5 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory touch-pan-x [&::-webkit-scrollbar]:hidden sm:gap-6"
              dir={isRTL ? "rtl" : "ltr"}
            >
              {packages.map((pkg, index) => (
                <motion.article
                  key={pkg.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05, duration: 0.4 }}
                  className="flex w-[min(82%,260px)] shrink-0 snap-start flex-col sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-4.5rem)/4)]"
                >
                  <div className="mb-4 flex h-8 w-8 items-center justify-center text-foreground">
                    <Package className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <h3 className="mb-2 text-base font-semibold leading-7 text-foreground">
                    {getLocalized(pkg.name, pkg.nameI18n)}
                  </h3>
                  <p className="line-clamp-3 min-h-[5.25rem] text-sm leading-8 text-muted-foreground">
                    {getLocalized(pkg.description, pkg.descriptionI18n) ||
                      `${pkg.credits} ${tCommon("credits")} · ${formatCurrency(pkg.price)}`}
                  </p>
                </motion.article>
              ))}
            </div>
          )}

          {pageCount > 1 ? (
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              className={`absolute top-1/2 hidden -translate-y-1/2 items-center justify-center text-muted-foreground transition hover:text-foreground md:flex ${
                isRTL ? "left-0" : "right-0"
              }`}
              aria-label={t("next")}
            >
              <ChevronRight className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} />
            </button>
          ) : null}
        </div>

        {!isLoading && !isError && packages.length > 0 ? (
          <div className="mt-6 flex justify-center sm:mt-10">
            <Link
              href="#pricing"
              className="inline-flex w-full max-w-xs items-center justify-center rounded-full border border-border bg-transparent px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-foreground/30 hover:bg-muted sm:w-auto sm:py-2"
            >
              {t("learnMore")}
            </Link>
          </div>
        ) : null}

        {pageCount > 1 ? (
          <div className="mt-8 flex items-center justify-center gap-2" role="tablist">
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={`pkg-page-${i + 1}`}
                type="button"
                role="tab"
                aria-selected={page === i}
                aria-label={`${t("page")} ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  page === i ? "w-5 bg-foreground" : "w-1.5 bg-foreground/25 hover:bg-foreground/40"
                }`}
                onClick={() => {
                  const el = scrollerRef.current;
                  if (!el) return;
                  const maxScroll = el.scrollWidth - el.clientWidth;
                  const target =
                    pageCount <= 1 ? 0 : (i / (pageCount - 1)) * maxScroll * (isRTL ? -1 : 1);
                  el.scrollTo({ left: target, behavior: "smooth" });
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
