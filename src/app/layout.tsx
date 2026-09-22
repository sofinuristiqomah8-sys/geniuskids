import type { Metadata, Viewport } from "next";
import "./globals.css";
import { brand, brandCssVars, emojiFaviconDataUrl, rgbToHex } from "../../config/brand";

export const metadata: Metadata = {
  title: `${brand.name} — Cerita Personal untuk Si Kecil`,
  description: `${brand.tagline} ${brand.subtagline}`,
  applicationName: brand.name,
  icons: {
    icon: brand.logoSrc ?? emojiFaviconDataUrl(),
    apple: brand.logoSrc ?? emojiFaviconDataUrl(),
  },
};

export const viewport: Viewport = {
  themeColor: rgbToHex(brand.colors.surface),
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={brand.defaultLocale}>
      <head>
        {/* Inject brand palette so editing config/brand.ts rebrands everything. */}
        <style>{`:root{${brandCssVars()}}`}</style>
        {/* Kid-friendly display + body fonts. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
