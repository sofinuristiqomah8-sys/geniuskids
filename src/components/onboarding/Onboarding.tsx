"use client";

import { useCallback, useEffect, useState } from "react";
import { t } from "@/lib/i18n";

/** Bump the suffix to re-show onboarding after a major product change. */
export const ONBOARDING_KEY = "gk_onboarding_v1";

const SLIDES = [
  { emoji: "🧒", titleKey: "onboarding.s1Title", bodyKey: "onboarding.s1Body" },
  { emoji: "🎨", titleKey: "onboarding.s2Title", bodyKey: "onboarding.s2Body" },
  { emoji: "🔊", titleKey: "onboarding.s3Title", bodyKey: "onboarding.s3Body" },
];

/**
 * First-run walkthrough. Renders nothing on the server and for returning
 * visitors — visibility is decided after mount so there's no hydration
 * mismatch and no flash for people who've already seen it.
 *
 * Listens for the `gk:show-onboarding` window event so a "Cara pakai" link can
 * replay it at any time.
 */
export default function Onboarding() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) setOpen(true);
    } catch {
      // Private mode / storage blocked — just skip onboarding.
    }
  }, []);

  useEffect(() => {
    function replay() {
      setI(0);
      setOpen(true);
    }
    window.addEventListener("gk:show-onboarding", replay);
    return () => window.removeEventListener("gk:show-onboarding", replay);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  const isLast = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("onboarding.howTo")}
      className="anim-fade-in fixed inset-0 z-[60] flex flex-col bg-surface/95 backdrop-blur-sm"
    >
      {/* Skip */}
      <div className="pt-safe flex justify-end px-5 pb-2">
        <button
          onClick={dismiss}
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:text-ink active:scale-95"
        >
          {t("onboarding.skip")}
        </button>
      </div>

      {/* Slide */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        {/* key forces the entrance animation to replay on each slide */}
        <div key={i} className="anim-fade-up flex flex-col items-center">
          <div className="float mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-brand-primary/10 text-6xl">
            {slide.emoji}
          </div>
          <h2 className="text-2xl font-extrabold text-ink">{t(slide.titleKey)}</h2>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
            {t(slide.bodyKey)}
          </p>
        </div>
      </div>

      {/* Dots + action */}
      <div className="pb-safe px-8">
        <div className="mb-5 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Slide ${idx + 1}`}
              aria-current={idx === i}
              className={`h-2 rounded-full transition-all ${
                idx === i ? "w-6 bg-brand-primary" : "w-2 bg-ink-faint/40"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => (isLast ? dismiss() : setI((v) => v + 1))}
          className={`btn-primary w-full ${isLast ? "pulse-glow" : ""}`}
        >
          {isLast ? t("onboarding.start") : t("onboarding.next")}
        </button>
      </div>
    </div>
  );
}

/** Small link that replays the walkthrough (used on the landing page). */
export function HowToButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("gk:show-onboarding"))}
      className="text-xs font-semibold text-ink-faint underline transition hover:text-ink-soft"
    >
      {t("onboarding.howTo")}
    </button>
  );
}
