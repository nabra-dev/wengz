"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLocale } from "next-intl";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export type GalleryLightboxItem =
  | { type: "image"; src: string; alt?: string }
  | { type: "video"; src: string; poster?: string };

type GalleryLightboxProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly GalleryLightboxItem[];
  index: number;
  onIndexChange: (index: number) => void;
  label: string;
};

const SWIPE_THRESHOLD_PX = 48;

export function GalleryLightbox({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
  label,
}: GalleryLightboxProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const touchStartX = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const item = items[index];
  const count = items.length;

  const go = useCallback(
    (delta: number) => {
      if (count === 0) return;
      onIndexChange((index + delta + count) % count);
      setDragOffset(0);
    },
    [count, index, onIndexChange]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(isRTL ? -1 : 1);
      if (event.key === "ArrowLeft") go(isRTL ? 1 : -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, isRTL, open]);

  useEffect(() => {
    if (!open) setDragOffset(0);
  }, [open, index]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/95" />
        <DialogPrimitive.Content
          dir="ltr"
          className={cn(
            "fixed inset-0 z-50 flex h-dvh w-screen flex-col outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>

          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
            <p className="rounded-full bg-black/50 px-3 py-1.5 text-sm font-medium text-white/85 tabular-nums backdrop-blur-sm">
              {index + 1} / {count}
            </p>
            <DialogClose
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white transition hover:bg-black/75"
              aria-label={isRTL ? "إغلاق" : "Close"}
            >
              <X className="h-5 w-5" />
            </DialogClose>
          </div>

          <div
            className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-2 sm:px-14"
            onTouchStart={(event) => {
              touchStartX.current = event.changedTouches[0]?.clientX ?? null;
              setDragOffset(0);
            }}
            onTouchMove={(event) => {
              const start = touchStartX.current;
              const x = event.changedTouches[0]?.clientX;
              if (start == null || x == null) return;
              setDragOffset(x - start);
            }}
            onTouchEnd={(event) => {
              const start = touchStartX.current;
              const x = event.changedTouches[0]?.clientX;
              touchStartX.current = null;
              if (start == null || x == null) {
                setDragOffset(0);
                return;
              }
              const delta = x - start;
              if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
                go(delta < 0 ? 1 : -1);
              } else {
                setDragOffset(0);
              }
            }}
          >
            <div
              className="relative flex h-full max-h-[min(88dvh,900px)] w-full max-w-6xl items-center justify-center transition-transform duration-150"
              style={{ transform: `translateX(${dragOffset * 0.35}px)` }}
            >
              {item.type === "image" ? (
                <Image
                  key={item.src}
                  src={item.src}
                  alt={item.alt ?? ""}
                  width={1600}
                  height={2000}
                  unoptimized
                  className="max-h-[min(88dvh,900px)] w-auto max-w-full object-contain select-none"
                  draggable={false}
                  priority
                />
              ) : (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  key={item.src}
                  src={item.src}
                  poster={item.poster}
                  className="max-h-[min(88dvh,900px)] w-auto max-w-full object-contain"
                  controls
                  playsInline
                  autoPlay
                  loop
                />
              )}
            </div>

            {count > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute start-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white transition hover:bg-black/75 sm:inline-flex"
                  aria-label={isRTL ? "السابق" : "Previous"}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute end-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white transition hover:bg-black/75 sm:inline-flex"
                  aria-label={isRTL ? "التالي" : "Next"}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
