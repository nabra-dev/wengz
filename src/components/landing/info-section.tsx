"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

const COLUMN_KEYS = ["media", "agencies", "teams"] as const;

export function InfoSection() {
  const t = useTranslations("landing.info");
  const locale = useLocale();
  const isRTL = locale === "ar";

  return (
    <section className="relative w-full bg-background px-4 py-12 sm:px-6 sm:py-24 lg:px-10">
      <div className="mx-auto grid max-w-[1400px] items-center gap-8 lg:grid-cols-[1.35fr_0.85fr] lg:gap-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className={isRTL ? "text-right" : "text-left"}
        >
          <h2 className="mb-8 max-w-xl text-[1.75rem] font-semibold leading-[1.3] tracking-tight text-foreground sm:mb-14 sm:text-4xl sm:leading-[1.28] md:text-5xl md:leading-[1.25]">
            {t("heading")}
          </h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-6">
            {COLUMN_KEYS.map((key, index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 * index, duration: 0.4 }}
              >
                <h3 className="mb-2 text-base font-semibold leading-7 text-foreground sm:mb-3 sm:text-xl sm:leading-8">
                  {t(`columns.${key}.title`)}
                </h3>
                <p className="text-sm leading-7 text-muted-foreground sm:leading-8">
                  {t(`columns.${key}.description`)}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 sm:mt-12">
            <Link
              href={t("ctaHref")}
              className="inline-flex w-full items-center justify-center rounded-full border border-[#E0F840]/45 bg-transparent px-5 py-2.5 text-sm font-medium text-foreground shadow-[0_0_18px_rgba(224,248,64,0.22)] transition hover:border-[#E0F840]/70 hover:shadow-[0_0_28px_rgba(224,248,64,0.35)] sm:w-auto sm:py-2"
            >
              {t("learnMore")}
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="relative aspect-[4/5] max-h-[420px] w-full overflow-hidden rounded-2xl sm:max-h-none sm:rounded-3xl lg:aspect-auto lg:min-h-[560px] lg:h-full"
        >
          <Image
            src="/images/landing/workflow.png"
            alt={t("imageAlt")}
            fill
            sizes="(max-width: 1024px) 100vw, 451px"
            className="object-cover object-center"
            priority={false}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}
