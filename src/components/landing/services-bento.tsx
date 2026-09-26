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

type ServiceTile = {
  key: string;
  image: string;
  icon: ComponentType<{ className?: string }>;
  area: "image" | "video" | "apps" | "mcp" | "flows" | "plugin" | "voice" | "music" | "studio";
  /** Intrinsic image target size (desktop card WxH) */
  imgW: number;
  imgH: number;
};

const BENTO_IMG = {
  design: "/images/landing/bento-imgs/design.png",
  video: "/images/landing/bento-imgs/video.png",
  production: "/images/landing/bento-imgs/production.png",
  voice: "/images/landing/bento-imgs/voice.png",
  workflow: "/images/landing/bento-imgs/workflow.png",
} as const;

const TILES: ServiceTile[] = [
  {
    key: "aiImage",
    image: BENTO_IMG.design,
    icon: ImageIcon,
    area: "image",
    imgW: 296,
    imgH: 528,
  },
  {
    key: "aiVideo",
    image: BENTO_IMG.video,
    icon: Clapperboard,
    area: "video",
    imgW: 296,
    imgH: 354,
  },
  {
    key: "apps",
    image: BENTO_IMG.production,
    icon: LayoutGrid,
    area: "apps",
    imgW: 296,
    imgH: 528,
  },
  {
    key: "mcp",
    image: BENTO_IMG.workflow,
    icon: Plug,
    area: "mcp",
    imgW: 296,
    imgH: 200,
  },
  {
    key: "flows",
    image: BENTO_IMG.workflow,
    icon: Workflow,
    area: "flows",
    imgW: 296,
    imgH: 324,
  },
  {
    key: "plugin",
    image: BENTO_IMG.design,
    icon: Sparkles,
    area: "plugin",
    imgW: 296,
    imgH: 140,
  },
  {
    key: "voiceover",
    image: BENTO_IMG.voice,
    icon: Mic2,
    area: "voice",
    imgW: 296,
    imgH: 150,
  },
  {
    key: "music",
    image: BENTO_IMG.voice,
    icon: Music2,
    area: "music",
    imgW: 296,
    imgH: 150,
  },
  {
    key: "studio",
    image: BENTO_IMG.production,
    icon: Clapperboard,
    area: "studio",
    imgW: 296,
    imgH: 324,
  },
];

export function ServicesBento() {
  const t = useTranslations("landing.services");

  return (
    <section
      id="services"
      className="relative w-full bg-background px-4 py-12 sm:px-6 sm:py-20 lg:px-10"
      aria-label={t("ariaLabel")}
    >
      <div className="mx-auto max-w-[1400px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="landing-services-bento grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-4"
        >
          {TILES.map((tile, index) => {
            const Icon = tile.icon;
            const title = t(`tiles.${tile.key}.title`);
            const description = t(`tiles.${tile.key}.description`);

            return (
              <motion.div
                key={tile.key}
                data-area={tile.area}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04, duration: 0.4 }}
                className={cn(
                  "group relative min-h-[160px] overflow-hidden rounded-2xl border border-border sm:rounded-3xl lg:min-h-0",
                  tile.area === "image" || tile.area === "apps"
                    ? "sm:min-h-[320px]"
                    : tile.area === "video"
                      ? "sm:min-h-[240px]"
                      : "sm:min-h-[180px]"
                )}
              >
                <Image
                  src={tile.image}
                  alt={title}
                  fill
                  sizes={`(max-width: 640px) 100vw, (max-width: 1024px) 50vw, ${tile.imgW}px`}
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-white/90" />
                    <h3 className="text-sm font-semibold leading-6 text-white sm:text-base sm:leading-7">
                      {title}
                    </h3>
                  </div>
                  <p className="line-clamp-2 text-xs leading-7 text-white/60 sm:text-sm sm:leading-7">
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
