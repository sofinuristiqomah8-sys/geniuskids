"use client";

import Link from "next/link";
import { useEffect } from "react";
import { t } from "@/lib/i18n";

/**
 * Branded error boundary for unexpected runtime failures (e.g. Supabase not
 * configured). Gives the user a way out instead of a raw stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface details in the console for debugging; keep the UI friendly.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="float text-6xl">🙈</div>
      <h1 className="anim-fade-up text-2xl font-extrabold text-ink">
        {t("common.errorTitle")}
      </h1>
      <p className="anim-fade-up d1 max-w-xs text-sm text-ink-soft">{t("common.errorBody")}</p>

      {error?.message && (
        <p className="anim-fade-up d2 max-w-sm break-words rounded-xl bg-surface-soft px-3 py-2 text-xs text-ink-faint">
          {error.message}
        </p>
      )}
      {error?.digest && (
        <p className="anim-fade-up d2 text-[11px] font-semibold text-ink-faint">
          Kode error: {error.digest}
        </p>
      )}

      <div className="anim-fade-up d3 mt-3 flex gap-3">
        <button onClick={reset} className="btn-primary">
          {t("common.tryAgain")}
        </button>
        <Link href="/" className="btn-secondary">
          {t("common.backHome")}
        </Link>
      </div>
    </main>
  );
}
