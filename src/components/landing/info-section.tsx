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
    <section className="relative w-full bg-black px-4 py-16 sm:px-6 sm:py-24 lg:px-10">
      <div className="mx-auto grid max-w-[1400px] items-center gap-10 lg:grid-cols-[1.35fr_0.85fr] lg:gap-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className={isRTL ? "text-right" : "text-left"}
        >
          <h2 className="mb-10 max-w-xl text-3xl font-semibold leading-snug tracking-tight text-white sm:mb-14 sm:text-4xl sm:leading-snug md:text-5xl md:leading-[1.2]">
            {t("heading")}
          </h2>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
            {COLUMN_KEYS.map((key, index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 * index, duration: 0.4 }}
              >
                <h3 className="mb-3 text-lg font-semibold leading-snug text-white sm:text-xl sm:leading-snug">
                  {t(`columns.${key}.title`)}
                </h3>
                <p className="mb-5 text-sm leading-7 text-white/50">
                  {t(`columns.${key}.description`)}
                </p>
                <Link
                  href={t(`columns.${key}.href`)}
                  className="inline-flex items-center rounded-full border border-[#E0F840]/45 bg-transparent px-5 py-2 text-sm font-medium text-white shadow-[0_0_18px_rgba(224,248,64,0.22)] transition hover:border-[#E0F840]/70 hover:shadow-[0_0_28px_rgba(224,248,64,0.35)]"
                >
                  {t("learnMore")}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl sm:rounded-3xl lg:aspect-auto lg:min-h-[560px] lg:h-full"
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
