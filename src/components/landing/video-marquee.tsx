"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { LazyGalleryVideo } from "@/components/landing/lazy-gallery-video";

/** `/images/landing/{n}.mp4` for n = 1..14 */
const GALLERY_VIDEO_INDICES = Array.from({ length: 14 }, (_, i) => i + 1);

function getVideoPlaybackLabel(locale: string, isPlaying: boolean) {
  if (isPlaying) {
    return locale === "ar" ? "إيقاف الفيديو" : "Pause video";
  }
  return locale === "ar" ? "تشغيل الفيديو" : "Play video";
}

function getVideoMuteLabel(locale: string, isMuted: boolean) {
  if (isMuted) {
    return locale === "ar" ? "إلغاء كتم الصوت" : "Unmute";
  }
  return locale === "ar" ? "كتم الصوت" : "Mute";
}

const marqueeDuration = (seconds: number): CSSProperties =>
  ({ "--landing-marquee-duration": `${seconds}s` }) as CSSProperties;

/** Infinite horizontal video strip — marquee pauses on hover. */
export function VideoMarquee() {
  const locale = useLocale();
  const t = useTranslations("landing.gallery.videos");
  const [playing, setPlaying] = useState<Record<number, boolean>>({});
  const [muted, setMuted] = useState<Record<number, boolean>>({});
  const [progress, setProgress] = useState<Record<number, number>>({});
  /** Duplicate strips share playback; key `${idx}-${strip}`. */
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const setGalleryVideoRef = useCallback(
    (idx: number, strip: 0 | 1) => (el: HTMLVideoElement | null) => {
      const key = `${idx}-${strip}`;
      if (el) videoRefs.current[key] = el;
      else delete videoRefs.current[key];
    },
    []
  );

  const getGalleryVideos = (idx: number): HTMLVideoElement[] =>
    ([0, 1] as const)
      .map((s) => videoRefs.current[`${idx}-${s}`])
      .filter((x): x is HTMLVideoElement => x != null);

  const togglePlayback = (idx: number) => {
    const els = getGalleryVideos(idx);
    if (els.length === 0) return;
    const anyPlaying = els.some((v) => !v.paused);
    els.forEach((el) => {
      if (anyPlaying) el.pause();
      else void el.play();
    });
  };

  const toggleMute = (idx: number) => {
    const els = getGalleryVideos(idx);
    const first = els[0];
    if (!first) return;
    const nextMuted = !first.muted;
    els.forEach((el) => {
      el.muted = nextMuted;
    });
    setMuted((prev) => ({ ...prev, [idx]: nextMuted }));
  };

  const seek = (idx: number, progressValue: number) => {
    const els = getGalleryVideos(idx);
    if (els.length === 0) return;
    const duration = els[0].duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const time = (progressValue / 100) * duration;
    els.forEach((el) => {
      el.currentTime = time;
    });
    setProgress((prev) => ({ ...prev, [idx]: progressValue }));
  };

  return (
    <section
      id="gallery"
      className="relative w-full overflow-hidden border-t border-border bg-background py-16 sm:py-24 md:py-32"
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
          <div
            className="flex w-max gap-3 animate-landing-marquee hover:[animation-play-state:paused] sm:gap-4 md:gap-5"
            style={marqueeDuration(70)}
          >
            {[0, 1].map((strip) => (
              <div key={`vstrip-${strip}`} className="flex shrink-0 gap-3 sm:gap-4 md:gap-5">
                {GALLERY_VIDEO_INDICES.map((idx) => (
                  <div
                    key={`landing-video-${idx}-${strip}`}
                    className="w-[42vw] max-w-[12rem] shrink-0 sm:w-48 sm:max-w-none md:w-52"
                  >
                    <div className="group relative overflow-hidden rounded-2xl border border-border bg-muted sm:rounded-3xl">
                      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(224,248,64,0.16),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(105,13,212,0.14),transparent_55%)]" />
                      <LazyGalleryVideo
                        className="aspect-[9/16] w-full object-cover"
                        src={`/images/landing/${idx}.mp4`}
                        videoRef={setGalleryVideoRef(idx, strip as 0 | 1)}
                        muted={muted[idx] ?? true}
                        onClick={() => {
                          togglePlayback(idx);
                        }}
                        onLoadedMetadata={
                          strip === 0
                            ? (event) => {
                                const target = event.currentTarget;
                                setMuted((prev) => ({
                                  ...prev,
                                  [idx]: target.muted,
                                }));
                                setProgress((prev) => ({
                                  ...prev,
                                  [idx]: 0,
                                }));
                              }
                            : undefined
                        }
                        onPlay={
                          strip === 0
                            ? () => {
                                setPlaying((prev) => ({ ...prev, [idx]: true }));
                              }
                            : undefined
                        }
                        onPause={
                          strip === 0
                            ? () => {
                                setPlaying((prev) => ({ ...prev, [idx]: false }));
                              }
                            : undefined
                        }
                        onTimeUpdate={
                          strip === 0
                            ? (event) => {
                                const target = event.currentTarget;
                                if (!Number.isFinite(target.duration) || target.duration <= 0) {
                                  return;
                                }
                                const next = (target.currentTime / target.duration) * 100;
                                setProgress((prev) => ({
                                  ...prev,
                                  [idx]: next,
                                }));
                              }
                            : undefined
                        }
                      />

                      <div
                        className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-12"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={0.1}
                            value={progress[idx] ?? 0}
                            onChange={(event) => {
                              seek(idx, Number(event.target.value));
                            }}
                            className="h-1 w-full cursor-pointer appearance-none bg-transparent accent-[#E0F840]"
                            aria-label={locale === "ar" ? "تقدم الفيديو" : "Video progress"}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              togglePlayback(idx);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
                            aria-label={getVideoPlaybackLabel(locale, playing[idx] ?? false)}
                          >
                            {playing[idx] ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              toggleMute(idx);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
                            aria-label={getVideoMuteLabel(locale, muted[idx] ?? true)}
                          >
                            {(muted[idx] ?? true) ? (
                              <VolumeX className="h-4 w-4" />
                            ) : (
                              <Volume2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
