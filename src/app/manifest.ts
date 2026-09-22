import type { MetadataRoute } from "next";
import { brand, emojiFaviconDataUrl, rgbToHex } from "../../config/brand";

/**
 * PWA manifest generated from the white-label brand config, so a rebranded
 * build is installable to a phone home screen with the buyer's own name,
 * colors, and icon — no extra files to edit.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: `${brand.tagline} ${brand.subtagline}`,
    start_url: "/",
    display: "standalone",
    background_color: rgbToHex(brand.colors.surface),
    theme_color: rgbToHex(brand.colors.primary),
    lang: brand.defaultLocale,
    icons: [
      {
        src: brand.logoSrc ?? emojiFaviconDataUrl(),
        sizes: "any",
        type: brand.logoSrc
          ? brand.logoSrc.endsWith(".svg")
            ? "image/svg+xml"
            : brand.logoSrc.endsWith(".jpg") || brand.logoSrc.endsWith(".jpeg")
              ? "image/jpeg"
              : "image/png"
          : "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
