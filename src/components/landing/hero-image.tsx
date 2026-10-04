export const HERO_SIZES = "100vw";

export const HERO_AVIF_SRCSET =
  "/images/hero/hero-640.avif 640w, /images/hero/hero-1080.avif 1080w, /images/hero/hero-1920.avif 1920w";

export const HERO_WEBP_SRCSET =
  "/images/hero/hero-640.webp 640w, /images/hero/hero-1080.webp 1080w, /images/hero/hero-1920.webp 1920w";

/** Pre-encoded hero. Served as a static file so the first view does not wait on the image optimizer. */
export function HeroImage() {
  return (
    <picture>
      <source type="image/avif" srcSet={HERO_AVIF_SRCSET} sizes={HERO_SIZES} />
      <source type="image/webp" srcSet={HERO_WEBP_SRCSET} sizes={HERO_SIZES} />
      {/* Static srcset: next/image would send this through the optimizer and delay LCP. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/hero/hero-1080.webp"
        alt=""
        width={1920}
        height={1080}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-[center_30%] sm:object-center"
        aria-hidden
      />
    </picture>
  );
}
