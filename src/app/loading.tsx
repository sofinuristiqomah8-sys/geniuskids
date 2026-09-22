import { brand } from "../../config/brand";
import { t } from "@/lib/i18n";

/** Branded route-transition loader (shown while a server page streams in). */
export default function Loading() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="float flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-card text-3xl shadow-sm ring-1 ring-black/[0.04]">
        {brand.logoEmoji}
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand-primary"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-xs font-semibold text-ink-faint">{t("common.loading")}</p>
    </main>
  );
}
