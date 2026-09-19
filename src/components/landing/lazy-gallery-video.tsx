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
  const [shouldLoad, setShouldLoad] = useState(
    () => typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    if (shouldLoad) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

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
  }, [shouldLoad]);

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
