/**
 * ============================================================================
 *  WHITE-LABEL BRAND CONFIG
 * ============================================================================
 *  A buyer rebrands the entire app by editing THIS FILE only.
 *  - Change name/tagline/logo emoji
 *  - Change the color palette (values are "R G B", space-separated, 0-255)
 *  - The colors flow into CSS variables (see src/app/globals.css) and then
 *    into Tailwind (see tailwind.config.ts) as `brand`, `surface`, `ink`.
 *
 *  No other file needs to change to rebrand.
 * ============================================================================
 */

export type BrandColors = {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  surfaceSoft: string;
  surfaceCard: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
};

export type Brand = {
  /** App name shown in header, title bar, landing hero. */
  name: string;
  /** One-line tagline under the hero. */
  tagline: string;
  /** Short supporting line. */
  subtagline: string;
  /** Emoji used as a lightweight logo mark (replace with an <img> later if desired). */
  logoEmoji: string;
  /** Optional path to a logo image in /public (e.g. "/logo.png"). Overrides emoji when set. */
  logoSrc?: string;
  /** Default language for content + UI. */
  defaultLocale: string;
  /** Palette. RGB channels as "R G B". */
  colors: BrandColors;
  /** Contact / footer links (optional). */
  links?: {
    website?: string;
    support?: string;
  };
};

export const brand: Brand = {
  name: "Genius Kids",
  tagline: "Cerita Cerdas untuk Anak Hebat,",
  subtagline: "dari Kisah Personal Mereka Sendiri.",
  logoEmoji: "🧠",
  logoSrc: "/logo.png",
  defaultLocale: "id",
  // Palette derived from the Genius Kids logo: bright blue primary, playful
  // yellow + pink accents, deep navy ink, cool-white surfaces.
  colors: {
    primary: "37 99 235", // vivid blue (book / "g")
    secondary: "236 72 153", // playful pink ("i")
    accent: "250 204 21", // sunny yellow ("n")
    surface: "246 249 255", // cool white
    surfaceSoft: "237 242 252",
    surfaceCard: "255 255 255",
    ink: "30 42 82", // deep navy ("kids")
    inkSoft: "85 96 125",
    inkFaint: "154 163 188",
  },
  links: {
    website: undefined,
    support: undefined,
  },
};

/** Convert an "R G B" channel string into a #hex color. */
export function rgbToHex(channels: string): string {
  const [r, g, b] = channels.trim().split(/\s+/).map((n) => Number(n));
  const h = (n: number) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** A data-URL SVG favicon rendered from the brand emoji (rebrands the tab icon). */
export function emojiFaviconDataUrl(emoji: string = brand.logoEmoji): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="54" font-size="80" text-anchor="middle" dominant-baseline="central">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Serialize the palette into a CSS custom-property block for :root. */
export function brandCssVars(b: Brand = brand): string {
  const c = b.colors;
  return [
    `--brand-primary: ${c.primary};`,
    `--brand-secondary: ${c.secondary};`,
    `--brand-accent: ${c.accent};`,
    `--surface: ${c.surface};`,
    `--surface-soft: ${c.surfaceSoft};`,
    `--surface-card: ${c.surfaceCard};`,
    `--ink: ${c.ink};`,
    `--ink-soft: ${c.inkSoft};`,
    `--ink-faint: ${c.inkFaint};`,
  ].join(" ");
}
