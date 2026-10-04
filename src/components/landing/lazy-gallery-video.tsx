"use client";

import { useEffect, useRef, useState, type RefCallback } from "react";

interface LazyGalleryVideoProps {
  readonly src: string;
  /** Static preview shown before the video source loads / plays. */
  readonly poster?: string;
  readonly className?: string;
  /** Initial muted state only — later changes must be done on the DOM node. */
  readonly muted?: boolean;
  readonly loop?: boolean;
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
  poster,
  className,
  muted = true,
  loop = false,
  videoRef,
  onClick,
  onLoadedMetadata,
  onPlay,
  onPause,
  onTimeUpdate,
  children,
}: LazyGalleryVideoProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const innerVideoRef = useRef<HTMLVideoElement | null>(null);
  const initialMutedRef = useRef(muted);
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
        ref={(node) => {
          innerVideoRef.current = node;
          // Apply initial mute once when the node mounts — never re-force on parent re-renders.
          if (node && initialMutedRef.current) {
            node.muted = true;
            node.defaultMuted = true;
            initialMutedRef.current = false;
          }
          if (typeof videoRef === "function") videoRef(node);
        }}
        playsInline
        loop={loop}
        preload="metadata"
        poster={shouldLoad ? poster : undefined}
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
