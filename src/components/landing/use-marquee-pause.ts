"use client";

import { useEffect, useRef } from "react";

/** Pause CSS marquees until the strip is near the viewport. */
export function useMarqueePause<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        el.classList.toggle("is-marquee-offscreen", !entry?.isIntersecting);
      },
      { rootMargin: "200px 0px", threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
