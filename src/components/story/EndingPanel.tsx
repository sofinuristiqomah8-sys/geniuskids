"use client";

import { useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { brand } from "../../../config/brand";
import Confetti from "@/components/ui/Confetti";

export type EndingData = {
  storyId: string;
  title: string | null;
  moral: string | null;
  doa: { arabic: string | null; latin: string | null; translation: string | null };
  activity: string | null;
  questions: string[];
};

export default function EndingPanel({ data }: { data: EndingData }) {
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  /** Read text aloud with the browser's built-in TTS (free, no server call). */
  function speak(id: string, text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = brand.defaultLocale === "id" ? "id-ID" : brand.defaultLocale;
    u.rate = 0.95;
    u.onend = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(u);
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-8">
      <Confetti />
      <div className="anim-pop mb-4 text-center text-5xl">🎉</div>
      {data.title && (
        <h1 className="anim-fade-up mb-5 text-center text-xl font-extrabold text-ink">
          {data.title}
        </h1>
      )}

      {/* Pesan Moral */}
      {data.moral && (
        <section className="card anim-fade-up d1 mb-4 border-l-4 border-brand-secondary p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-brand-secondary">
              💡 {t("story.moralTitle")}
            </h2>
            <ListenButton
              active={speakingId === "moral"}
              onClick={() => speak("moral", data.moral!)}
            />
          </div>
          <p className="text-sm leading-relaxed text-ink-soft">{data.moral}</p>
        </section>
      )}

      {/* Mari Berdoa */}
      {(data.doa.arabic || data.doa.latin || data.doa.translation) && (
        <section className="card anim-fade-up d2 mb-4 border-l-4 border-emerald-500 bg-emerald-50/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-emerald-700">
              🤲 {t("story.prayerTitle")}
            </h2>
            <ListenButton
              active={speakingId === "doa"}
              onClick={() =>
                speak("doa", data.doa.latin || data.doa.translation || data.doa.arabic || "")
              }
            />
          </div>
          {data.doa.arabic && (
            <p dir="rtl" lang="ar" className="mb-2 text-center text-2xl leading-loose text-ink">
              {data.doa.arabic}
            </p>
          )}
          {data.doa.latin && (
            <p className="text-center text-sm font-medium italic text-emerald-800">
              {data.doa.latin}
            </p>
          )}
          {data.doa.translation && (
            <p className="mt-1 text-center text-xs text-ink-soft">
              &ldquo;{data.doa.translation}&rdquo;
            </p>
          )}
        </section>
      )}

      {/* Panduan Orang Tua */}
      {(data.activity || data.questions.length > 0) && (
        <section className="card anim-fade-up d3 mb-6 bg-surface-soft/60 p-5">
          <h2 className="font-display text-base font-bold text-ink">
            👨‍👩‍👧 {t("story.parentGuideTitle")}
          </h2>
          {data.activity && (
            <div className="mt-2">
              <p className="text-sm font-bold text-ink">{t("story.parentActivity")}</p>
              <p className="text-sm leading-relaxed text-ink-soft">{data.activity}</p>
            </div>
          )}
          {data.questions.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-bold text-ink">{t("story.parentAsk")}</p>
              <ul className="mt-1 space-y-1">
                {data.questions.map((q, i) => (
                  <li key={i} className="text-sm leading-relaxed text-ink-soft">
                    • {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Actions */}
      <div className="anim-fade-up d4 flex gap-3">
        <Link href={`/story/${data.storyId}/read`} className="btn-secondary flex-1">
          {t("story.repeat")}
        </Link>
        <Link href="/create" className="btn-primary flex-1">
          {t("story.newStory")}
        </Link>
      </div>
      <div className="mt-3 text-center">
        <Link href="/collection" className="text-sm font-semibold text-brand-primary">
          {t("story.viewCollection")}
        </Link>
      </div>
    </div>
  );
}

function ListenButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary"
    >
      {active ? `⏸ ${t("story.pause")}` : `🔊 ${t("story.listen")}`}
    </button>
  );
}
