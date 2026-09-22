import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "../../../config/brand";
import { t } from "@/lib/i18n";

/**
 * Consistent app header used on every screen except the landing hero and the
 * immersive flipbook reader (which has its own top bar).
 *
 * Layout is three zones so the title stays optically centered:
 *   [ back or logo ]   [ title ]   [ optional action ]
 */
export default function AppHeader({
  backHref,
  title,
  right,
}: {
  /** When set, shows a back arrow to this href. Otherwise shows the brand mark. */
  backHref?: string;
  title?: string;
  right?: ReactNode;
}) {
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-black/[0.04] bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 pb-3">
        {/* Left */}
        <div className="flex min-w-[2.25rem] shrink-0 justify-start">
          {backHref ? (
            <Link
              href={backHref}
              aria-label={t("header.back")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-card text-lg text-ink-soft ring-1 ring-black/[0.05] transition hover:text-ink active:scale-90"
            >
              ←
            </Link>
          ) : (
            <Link
              href="/"
              aria-label={t("header.home")}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/10 text-base transition active:scale-90"
            >
              {brand.logoEmoji}
            </Link>
          )}
        </div>

        {/* Title */}
        <p className="min-w-0 flex-1 truncate text-center text-sm font-bold text-ink">
          {title ?? brand.name}
        </p>

        {/* Right */}
        <div className="flex min-w-[2.25rem] shrink-0 justify-end">{right}</div>
      </div>
    </header>
  );
}
