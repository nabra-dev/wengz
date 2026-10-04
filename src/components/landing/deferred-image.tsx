"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Below-fold photos stay out of the first load.
 * `loading="lazy"` still fetches on a fast connection, and Lighthouse replays
 * that download onto Slow 4G, which pushes the hero text out.
 */
function useDeferredReady() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin: "200px 0px", threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, ready] as const;
}

export function DeferredImage({ className, alt, ...rest }: ImageProps) {
  const [ref, ready] = useDeferredReady();

  return (
    <div ref={ref} className="h-full w-full">
      {ready ? <Image {...rest} alt={alt} className={className} /> : null}
    </div>
  );
}

export function DeferredFillImage({ className, alt, ...rest }: Omit<ImageProps, "fill">) {
  const [ref, ready] = useDeferredReady();

  return (
    <div ref={ref} className="absolute inset-0">
      {ready ? <Image {...rest} alt={alt} fill className={className} /> : null}
    </div>
  );
}
