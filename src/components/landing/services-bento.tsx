"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Image as ImageIcon,
  Clapperboard,
  LayoutGrid,
  Mic2,
  Music2,
  Workflow,
  Plug,
  Sparkles,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

type TileKind = "image" | "info";

/**
 * Desktop bento (4 cols × 4 row tracks):
 *
 *  image | video  | apps | mcp
 *  image | video  | apps | plugin
 *  image | flows  | apps | studio
 *  voice | flows  | music| studio
 */
type ServiceTile = {
  key: string;
  kind: TileKind;
  image?: string;
  icon: ComponentType<{ className?: string }>;
  area: "image" | "video" | "apps" | "mcp" | "flows" | "plugin" | "voice" | "music" | "studio";
  /** Next/Image `sizes` — matches each card’s rendered width */
  sizes: string;
};

const TILES: ServiceTile[] = [
  {
    key: "aiImage",
    kind: "image",
    image: "/images/landing/1.jpg",
    icon: ImageIcon,
    area: "image",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px",
  },
  {
    key: "aiVideo",
    kind: "image",
    image: "/images/landing/3.jpg",
    icon: Clapperboard,
    area: "video",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px",
  },
  {
    key: "apps",
    kind: "image",
    image: "/images/landing/6.jpg",
    icon: LayoutGrid,
    area: "apps",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px",
  },
  {
    key: "mcp",
    kind: "info",
    icon: Plug,
    area: "mcp",
    sizes: "(max-width: 1024px) 100vw, 280px",
  },
  {
    key: "flows",
    kind: "image",
    image: "/images/landing/8.jpg",
    icon: Workflow,
    area: "flows",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px",
  },
  {
    key: "plugin",
    kind: "info",
    icon: Sparkles,
    area: "plugin",
    sizes: "(max-width: 1024px) 100vw, 280px",
  },
  {
    key: "voiceover",
    kind: "image",
    image: "/images/landing/10.jpg",
    icon: Mic2,
    area: "voice",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px",
  },
  {
    key: "music",
    kind: "image",
    image: "/images/landing/12.jpg",
    icon: Music2,
    area: "music",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px",
  },
  {
    key: "studio",
    kind: "image",
    image: "/images/landing/15.jpg",
    icon: Clapperboard,
    area: "studio",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px",
  },
];

export function ServicesBento() {
  const t = useTranslations("landing.services");

  return (
    <section
      id="services"
      className="relative w-full bg-black px-4 py-16 sm:px-6 sm:py-20 lg:px-10"
      aria-label={t("ariaLabel")}
    >
      <div className="mx-auto max-w-[1400px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="landing-services-bento grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5"
        >
          {TILES.map((tile, index) => {
            const Icon = tile.icon;
            const title = t(`tiles.${tile.key}.title`);
            const description = t(`tiles.${tile.key}.description`);

            if (tile.kind === "info") {
              return (
                <motion.div
                  key={tile.key}
                  data-area={tile.area}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.04, duration: 0.4 }}
                  className="flex min-h-[132px] flex-col justify-between rounded-2xl border border-white/10 bg-[#111]/95 p-5 backdrop-blur-md sm:rounded-3xl sm:p-6 lg:min-h-0"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#690DD4]/40 to-[#E0F840]/25 ring-1 ring-white/10">
                      <Icon className="h-4 w-4 text-white" />
                    </span>
                    <h3 className="text-base font-semibold text-white">{title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/55">{description}</p>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={tile.key}
                data-area={tile.area}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04, duration: 0.4 }}
                className={cn(
                  "group relative min-h-[200px] overflow-hidden rounded-2xl border border-white/10 sm:rounded-3xl lg:min-h-0",
                  tile.area === "image" || tile.area === "apps"
                    ? "sm:min-h-[320px]"
                    : tile.area === "video"
                      ? "sm:min-h-[240px]"
                      : "sm:min-h-[180px]"
                )}
              >
                <Image
                  src={tile.image ?? "/images/landing/1.jpg"}
                  alt={title}
                  fill
                  sizes={tile.sizes}
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-white/90" />
                    <h3 className="text-sm font-semibold text-white sm:text-base">{title}</h3>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-white/60 sm:text-sm">
                    {description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
