import Link from "next/link";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="float text-6xl">🔎📖</div>
      <h1 className="anim-fade-up text-2xl font-extrabold text-ink">
        {t("common.notFoundTitle")}
      </h1>
      <p className="anim-fade-up d1 max-w-xs text-sm text-ink-soft">
        {t("common.notFoundBody")}
      </p>
      <Link href="/" className="btn-primary anim-fade-up d2 mt-3">
        {t("common.backHome")}
      </Link>
    </main>
  );
}
