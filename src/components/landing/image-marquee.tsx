"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useMarqueePause } from "@/components/landing/use-marquee-pause";

/** Featured Works — two rows; `/images/landing/gallery/{n}.webp` for n = 1..31 */
const GALLERY_IMAGE_ROW_A = Array.from({ length: 16 }, (_, i) => i + 1);
const GALLERY_IMAGE_ROW_B = Array.from({ length: 15 }, (_, i) => i + 17);
const GALLERY_IMAGE_SRC = (n: number) => `/images/landing/gallery/${n}.webp`;

function MarqueeRow({
  indices,
  reverse = false,
  duration,
}: {
  indices: number[];
  reverse?: boolean;
  duration: string;
}) {
  return (
    <div className="relative w-full overflow-hidden py-1" dir="ltr">
      <div
        className={`flex w-max gap-3 sm:gap-4 md:gap-5 ${
          reverse ? "animate-landing-marquee-reverse" : "animate-landing-marquee"
        }`}
        style={{ ["--landing-marquee-duration" as string]: duration }}
      >
        {[0, 1].map((strip) => (
          <div key={`imgstrip-${strip}`} className="flex shrink-0 gap-3 sm:gap-4 md:gap-5">
            {indices.map((n) => (
              <div
                key={`landing-img-${n}-${strip}`}
                className="group relative aspect-[4/5] w-[38vw] max-w-[11rem] shrink-0 overflow-hidden rounded-lg border border-border transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-[0_18px_70px_rgba(0,0,0,0.35)] sm:w-44 sm:max-w-none sm:rounded-xl md:w-48"
              >
                <div className="pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity group-hover:opacity-100 bg-[linear-gradient(135deg,rgba(105,13,212,0.18),transparent_45%),linear-gradient(315deg,rgba(224,248,64,0.16),transparent_45%)]" />
                <Image
                  src={GALLERY_IMAGE_SRC(n)}
                  alt=""
                  width={448}
                  height={560}
                  unoptimized
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dual-row infinite image marquees (featured work). */
export function ImageMarquee() {
  const t = useTranslations("landing.gallery.images");
  const sectionRef = useMarqueePause<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      id="gallery"
      className="relative w-full scroll-mt-28 overflow-hidden border-t border-border bg-background py-16 sm:scroll-mt-32 sm:py-24 md:py-32"
      aria-label={t("heading")}
    >
      <div className="container px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center sm:mb-12"
        >
          <h2 className="mb-4 text-[1.75rem] font-semibold leading-[1.3] tracking-tight text-foreground sm:mb-6 sm:text-4xl sm:leading-[1.28] md:text-5xl md:leading-[1.25]">
            {t("heading")}
          </h2>
          <p className="text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            {t("subheading")}
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-8 sm:gap-10"
      >
        <MarqueeRow indices={GALLERY_IMAGE_ROW_A} duration="140s" />
        <MarqueeRow indices={GALLERY_IMAGE_ROW_B} reverse duration="160s" />
      </motion.div>
    </section>
  );
}
