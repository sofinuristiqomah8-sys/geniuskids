"use client";

import Image from "next/image";
import { useState } from "react";
import { brand } from "../../../config/brand";

/**
 * Animated brand logo.
 *  - entrance pop, gentle idle float
 *  - pulsing brand-colored halo behind the artwork
 *  - a light "shine" glint sweeping across the logo
 *  - twinkling sparkles + two orbiting idea icons
 *  - hover: lifts, scales and tilts
 *
 * Uses next/image so the 1080px source is auto-resized/WebP-optimized.
 * Falls back to the emoji mark + wordmark if the image is missing.
 */
export default function BrandLogo({ size = 272 }: { size?: number }) {
  const [failed, setFailed] = useState(false);

  if (!brand.logoSrc || failed) {
    return (
      <>
        <div className="anim-pop float mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-card text-4xl shadow-sm ring-1 ring-black/[0.04]">
          <span>{brand.logoEmoji}</span>
        </div>
        <h1 className="anim-fade-up text-4xl font-extrabold tracking-tight text-brand-primary">
          {brand.name}
        </h1>
      </>
    );
  }

  return (
    <div
      className="anim-pop relative mx-auto mb-2"
      style={{ width: size, maxWidth: "80%" }}
    >
      {/* Pulsing halo */}
      <div
        aria-hidden
        className="glow-pulse absolute inset-4 -z-10 rounded-full bg-gradient-to-tr from-brand-primary/45 via-brand-accent/35 to-brand-secondary/45 blur-3xl"
      />

      {/* Twinkling sparkles around the mark */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="sparkle absolute -left-3 top-6 text-lg">✨</span>
        <span className="sparkle absolute -right-2 top-10 text-base" style={{ animationDelay: "0.7s" }}>
          ⭐
        </span>
        <span className="sparkle absolute left-6 -top-2 text-sm" style={{ animationDelay: "1.3s" }}>
          💫
        </span>
        <span className="sparkle absolute right-8 bottom-10 text-sm" style={{ animationDelay: "1.9s" }}>
          ✨
        </span>
      </div>

      {/* Orbiting idea icons */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-0 w-0"
        style={{ "--orbit-r": `${Math.round(size * 0.42)}px` } as React.CSSProperties}
      >
        <span className="orbit absolute text-base">💡</span>
        <span className="orbit-reverse absolute text-sm">🧩</span>
      </div>

      {/* Logo artwork + shine glint */}
      <div className="group relative float">
        <Image
          src={brand.logoSrc}
          alt={brand.name}
          width={size}
          height={size}
          priority
          onError={() => setFailed(true)}
          className="h-auto w-full select-none object-contain transition-transform duration-300 ease-out group-hover:-rotate-2 group-hover:scale-105"
        />
        <span aria-hidden className="logo-shine" />
      </div>
    </div>
  );
}
