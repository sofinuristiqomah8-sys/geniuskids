import Link from "next/link";
import { brand } from "../../config/brand";
import { t } from "@/lib/i18n";
import BrandLogo from "@/components/ui/BrandLogo";
import Onboarding, { HowToButton } from "@/components/onboarding/Onboarding";

export default function LandingPage() {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6">
      {/* Soft decorative blobs (brand-tinted, gently floating) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="float-slow absolute -left-16 top-10 h-40 w-40 rounded-full bg-brand-accent/25 blur-2xl" />
        <span className="float absolute right-[-3rem] top-24 h-52 w-52 rounded-full bg-brand-primary/15 blur-3xl" />
        <span className="float-slow absolute bottom-8 left-8 h-40 w-40 rounded-full bg-brand-secondary/15 blur-2xl" style={{ animationDelay: "1.5s" }} />
        <span className="float absolute bottom-24 right-10 h-28 w-28 rounded-full bg-brand-accent/20 blur-2xl" style={{ animationDelay: "0.8s" }} />
      </div>

      {/* Twinkling sparkles */}
      <div aria-hidden className="pointer-events-none absolute inset-0 text-xl">
        <span className="sparkle absolute left-8 top-24">✨</span>
        <span className="sparkle absolute right-10 top-16" style={{ animationDelay: "0.6s" }}>⭐</span>
        <span className="sparkle absolute left-1/2 top-10" style={{ animationDelay: "1.2s" }}>🌟</span>
        <span className="sparkle absolute bottom-28 left-12" style={{ animationDelay: "0.9s" }}>✨</span>
        <span className="sparkle absolute bottom-16 right-16" style={{ animationDelay: "1.6s" }}>⭐</span>
      </div>

      <div className="relative z-10 w-full max-w-sm text-center">
        <BrandLogo />
        <p className="anim-fade-up d2 mt-3 text-sm leading-relaxed text-ink-soft">
          {brand.tagline}
          <br />
          {brand.subtagline}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/create" className="btn-primary anim-fade-up d3 pulse-glow w-full">
            ✨ {t("landing.ctaCreate")}
          </Link>
          <Link href="/collection" className="btn-secondary anim-fade-up d4 w-full">
            📚 {t("landing.ctaCollection")}
          </Link>
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-ink-faint">
          <HowToButton />
          {brand.links?.website && (
            <>
              <span>·</span>
              <a href={brand.links.website} className="hover:text-ink-soft">
                {brand.name}
              </a>
            </>
          )}
          {brand.links?.support && (
            <>
              <span>·</span>
              <a href={brand.links.support} className="hover:text-ink-soft">
                Bantuan
              </a>
            </>
          )}
        </p>
      </div>

      {/* First-run walkthrough (shows once, replayable via "Cara pakai"). */}
      <Onboarding />
    </main>
  );
}
