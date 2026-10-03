"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Volume2, VolumeX } from "lucide-react";
import { LazyGalleryVideo } from "@/components/landing/lazy-gallery-video";

/** `/images/landing/{n}.mp4` for n = 1..14 */
const GALLERY_VIDEO_INDICES = Array.from({ length: 14 }, (_, i) => i + 1);

const MARQUEE_SPEED_PX = 0.45;

/** Infinite horizontal video strip — play on hover; click to unmute; only one at a time. */
export function VideoMarquee() {
  const locale = useLocale();
  const t = useTranslations("landing.gallery.videos");
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const marqueePausedRef = useRef(false);
  const offsetRef = useRef(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [unmutedKey, setUnmutedKey] = useState<string | null>(null);

  const galleryRefCallbacks = useRef<Record<string, (el: HTMLVideoElement | null) => void>>({});

  const setGalleryVideoRef = useCallback((idx: number, strip: 0 | 1) => {
    const key = `${idx}-${strip}`;
    if (!galleryRefCallbacks.current[key]) {
      galleryRefCallbacks.current[key] = (el: HTMLVideoElement | null) => {
        if (el) videoRefs.current[key] = el;
        else delete videoRefs.current[key];
      };
    }
    return galleryRefCallbacks.current[key];
  }, []);

  const resetAllVideos = useCallback((exceptKey?: string) => {
    Object.entries(videoRefs.current).forEach(([key, el]) => {
      if (!el || key === exceptKey) return;
      el.pause();
      el.currentTime = 0;
      el.muted = true;
    });
  }, []);

  const playOnHover = useCallback(
    (key: string) => {
      const el = videoRefs.current[key];
      if (!el) return;
      resetAllVideos(key);
      // Browsers only allow autoplay when muted; sound unlocks on click.
      el.muted = true;
      el.defaultMuted = true;
      void el.play().catch(() => {
        /* ignore transient autoplay failures */
      });
      setActiveKey(key);
      setUnmutedKey(null);
      marqueePausedRef.current = true;
    },
    [resetAllVideos]
  );

  const stopOnLeave = useCallback((key: string) => {
    const el = videoRefs.current[key];
    if (el) {
      el.pause();
      el.currentTime = 0;
      el.muted = true;
    }
    setActiveKey((current) => {
      if (current === key) {
        marqueePausedRef.current = false;
        return null;
      }
      return current;
    });
    setUnmutedKey((current) => (current === key ? null : current));
  }, []);

  const toggleMute = useCallback((key: string) => {
    const el = videoRefs.current[key];
    if (!el) return;

    Object.entries(videoRefs.current).forEach(([k, video]) => {
      if (!video || k === key) return;
      video.muted = true;
    });

    if (el.muted) {
      el.muted = false;
      el.volume = 1;
      setUnmutedKey(key);
      void el.play().catch(() => {
        /* ignore */
      });
      return;
    }

    el.muted = true;
    setUnmutedKey(null);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;
    const tick = () => {
      if (!marqueePausedRef.current) {
        offsetRef.current -= MARQUEE_SPEED_PX;
        const half = track.scrollWidth / 2;
        if (half > 0 && Math.abs(offsetRef.current) >= half) {
          offsetRef.current += half;
        }
        track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section
      id="gallery-videos"
      className="relative w-full scroll-mt-28 overflow-hidden border-t border-border bg-background py-16 sm:scroll-mt-32 sm:py-24 md:py-32"
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
        className="mt-8 w-full"
      >
        <div className="relative w-full overflow-hidden py-1" dir="ltr">
          <div ref={trackRef} className="flex w-max gap-3 will-change-transform sm:gap-4 md:gap-5">
            {[0, 1].map((strip) => (
              <div key={`vstrip-${strip}`} className="flex shrink-0 gap-3 sm:gap-4 md:gap-5">
                {GALLERY_VIDEO_INDICES.map((idx) => {
                  const key = `${idx}-${strip as 0 | 1}`;
                  const isActive = activeKey === key;
                  const isUnmuted = unmutedKey === key;
                  return (
                    <div
                      key={`landing-video-${key}`}
                      className="w-[42vw] max-w-[12rem] shrink-0 sm:w-48 sm:max-w-none md:w-52"
                      onMouseEnter={() => playOnHover(key)}
                      onMouseLeave={() => stopOnLeave(key)}
                    >
                      <div
                        className={`group relative overflow-hidden rounded-2xl border bg-muted transition-[border-color,box-shadow] duration-300 sm:rounded-3xl ${
                          isActive
                            ? "border-[#E0F840]/50 shadow-[0_0_28px_rgba(105,13,212,0.35)]"
                            : "border-border"
                        }`}
                      >
                        <div className="pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(224,248,64,0.16),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(105,13,212,0.14),transparent_55%)]" />
                        <LazyGalleryVideo
                          className="aspect-[9/16] w-full cursor-pointer object-cover"
                          src={`/images/landing/${idx}.mp4`}
                          poster={`/images/landing/video-thumbs/${idx}.jpg`}
                          videoRef={setGalleryVideoRef(idx, strip as 0 | 1)}
                          muted
                          loop
                          onClick={() => toggleMute(key)}
                        />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleMute(key);
                          }}
                          className={`pointer-events-auto absolute bottom-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70 ${
                            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          }`}
                          aria-label={
                            isUnmuted
                              ? locale === "ar"
                                ? "كتم الصوت"
                                : "Mute"
                              : locale === "ar"
                                ? "إلغاء كتم الصوت"
                                : "Unmute"
                          }
                        >
                          {isUnmuted ? (
                            <Volume2 className="h-4 w-4" />
                          ) : (
                            <VolumeX className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
