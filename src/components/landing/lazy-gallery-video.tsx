"use client";

import { useEffect, useRef, useState, type RefCallback } from "react";

interface LazyGalleryVideoProps {
  readonly src: string;
  readonly className?: string;
  readonly muted?: boolean;
  readonly videoRef?: RefCallback<HTMLVideoElement | null>;
  readonly onClick?: () => void;
  readonly onLoadedMetadata?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  readonly onPlay?: () => void;
  readonly onPause?: () => void;
  readonly onTimeUpdate?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  readonly children?: React.ReactNode;
}

/**
 * Mounts the video source only when the element enters (or is near) the viewport.
 * Avoids fetching all marquee MP4s on first paint.
 *
 * `shouldLoad` must start false on both server and client so SSR HTML matches.
 * Loading is deferred to an effect (IntersectionObserver or immediate fallback).
 */
export function LazyGalleryVideo({
  src,
  className,
  muted = true,
  videoRef,
  onClick,
  onLoadedMetadata,
  onPlay,
  onPause,
  onTimeUpdate,
  children,
}: LazyGalleryVideoProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      const id = window.setTimeout(() => setShouldLoad(true), 0);
      return () => window.clearTimeout(id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={className ? undefined : "relative"}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        className={className}
        ref={videoRef}
        playsInline
        muted={muted}
        preload="none"
        tabIndex={-1}
        onClick={onClick}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
      >
        {shouldLoad ? <source src={src} type="video/mp4" /> : null}
        {children}
      </video>
    </div>
  );
}
