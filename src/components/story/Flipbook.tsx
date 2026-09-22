"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import type { WordTiming } from "@/lib/database.types";

export type FlipScene = {
  index: number;
  narration: string | null;
  /** 2-3 sequential illustrations shown left-to-right on the page. */
  imageUrls: (string | null)[];
  audioUrl: string | null;
  timings: WordTiming[];
};

const SWIPE_THRESHOLD = 60; // px

/**
 * Renders a scene's 2-3 sequential illustrations as one continuous panel strip.
 * A single image keeps the classic full-frame look; multiples sit side-by-side
 * (stacked on narrow screens) so the eye reads them left → right in order.
 */
function SceneImages({
  images,
  sceneNumber,
}: {
  images: (string | null)[];
  sceneNumber: number;
}) {
  const urls = images.length > 0 ? images : [null];
  const single = urls.length === 1;

  return (
    <div
      className={`mx-auto w-full max-w-md ${
        single ? "" : "grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2"
      }`}
    >
      {urls.map((url, i) =>
        url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={url}
            alt={`Adegan ${sceneNumber}, gambar ${i + 1}`}
            className={`w-full rounded-card object-cover shadow-sm ring-1 ring-black/[0.04] ${
              single ? "kenburns aspect-[4/3]" : "aspect-[3/4]"
            }`}
          />
        ) : (
          <div
            key={i}
            className={`flex w-full items-center justify-center rounded-card bg-surface-soft text-ink-faint ${
              single ? "aspect-[4/3]" : "aspect-[3/4]"
            }`}
          >
            🎨
          </div>
        )
      )}
    </div>
  );
}

export default function Flipbook({
  storyId,
  title,
  scenes,
}: {
  storyId: string;
  title: string | null;
  scenes: FlipScene[];
}) {
  const router = useRouter();
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [auto, setAuto] = useState(false);
  const [wordIdx, setWordIdx] = useState(-1);
  const [progress, setProgress] = useState(0); // 0..1 of current scene audio

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Latest flags for use inside audio event handlers (avoid stale closures).
  const autoRef = useRef(auto);
  const playingRef = useRef(playing);
  autoRef.current = auto;
  playingRef.current = playing;

  const scene = scenes[cur];
  const isLast = cur >= scenes.length - 1;

  const finish = useCallback(() => {
    router.push(`/story/${storyId}/ending`);
  }, [router, storyId]);

  const goPrev = useCallback(() => {
    setCur((c) => (c > 0 ? c - 1 : c));
  }, []);

  const goNext = useCallback(() => {
    if (!isLast) setCur((c) => c + 1);
    else finish();
  }, [isLast, finish]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || !scene?.audioUrl) return;
    if (a.paused) {
      void a.play().catch(() => {});
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }, [scene?.audioUrl]);

  // Reset + auto-resume playback when the page turns.
  useEffect(() => {
    const a = audioRef.current;
    setWordIdx(-1);
    setProgress(0);
    if (!a) return;
    a.currentTime = 0;
    if (playingRef.current || autoRef.current) {
      void a.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);

  // Preload the NEXT scene's images + audio so page turns feel instant.
  useEffect(() => {
    const next = scenes[cur + 1];
    if (!next) return;
    for (const url of next.imageUrls) {
      if (!url) continue;
      const img = new Image();
      img.src = url;
    }
    if (next.audioUrl) {
      const a = new Audio();
      a.preload = "auto";
      a.src = next.audioUrl;
    }
  }, [cur, scenes]);

  // Keyboard: ← → navigate, Space play/pause, Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "Escape") {
        router.push(`/story/${storyId}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, togglePlay, router, storyId]);

  // Swipe left/right to turn pages (primary interaction on phones).
  const touchStartX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.changedTouches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dx < 0) goNext();
    else goPrev();
  }

  function onTimeUpdate() {
    const a = audioRef.current;
    if (!a) return;
    if (a.duration > 0) setProgress(a.currentTime / a.duration);

    if (scene.timings.length === 0) return;
    const ms = a.currentTime * 1000;
    let idx = -1;
    for (let i = 0; i < scene.timings.length; i++) {
      if (ms >= scene.timings[i].startMs && ms < scene.timings[i].endMs) {
        idx = i;
        break;
      }
      if (ms >= scene.timings[i].startMs) idx = i; // last word that has started
    }
    setWordIdx(idx);
  }

  function onEnded() {
    setProgress(1);
    if (autoRef.current && !isLast) {
      setCur((c) => c + 1); // effect auto-plays the next page
    } else if (autoRef.current && isLast) {
      setPlaying(false);
      setAuto(false);
      finish();
    } else {
      setPlaying(false);
    }
  }

  function toggleAuto() {
    const next = !auto;
    setAuto(next);
    if (next) {
      const a = audioRef.current;
      if (a) {
        void a.play().catch(() => {});
        setPlaying(true);
      }
    }
  }

  /** Tap a word to replay the narration from that word. */
  function seekToWord(i: number) {
    const a = audioRef.current;
    const timing = scene.timings[i];
    if (!a || !timing) return;
    a.currentTime = timing.startMs / 1000;
    setWordIdx(i);
    void a.play().catch(() => {});
    setPlaying(true);
  }

  return (
    <main
      className="flex min-h-[100dvh] flex-col bg-surface"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="pt-safe flex items-center justify-between px-4 pb-2">
        <Link
          href={`/story/${storyId}`}
          aria-label="Tutup"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-card text-lg text-ink-soft ring-1 ring-black/[0.05] transition active:scale-90"
        >
          ✕
        </Link>
        <p className="truncate px-2 text-sm font-bold text-ink">{title}</p>
        <button
          onClick={toggleAuto}
          aria-pressed={auto}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition active:scale-95 ${
            auto
              ? "bg-brand-primary text-white ring-brand-primary"
              : "bg-surface-card text-ink-soft ring-black/[0.05]"
          }`}
        >
          {auto ? "■ " : "▶ "}
          {t("story.autoplay").replace(/^▶\s*/, "")}
        </button>
      </div>

      {/* Book page (re-animates on page turn via key) */}
      <div
        key={cur}
        className="anim-page flex flex-1 flex-col gap-4 px-4 pb-2 md:flex-row md:items-center"
      >
        {/* Illustration sequence (2-3 continuous images, left → right) */}
        <div className="md:flex-1">
          <SceneImages images={scene.imageUrls} sceneNumber={cur + 1} />
        </div>

        {/* Narration with karaoke highlight */}
        <div className="md:flex-1">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-primary">
            {t("story.sceneOf", { current: cur + 1, total: scenes.length })}
          </p>
          <p className="text-lg leading-relaxed text-ink md:text-xl">
            {scene.timings.length > 0
              ? scene.timings.map((w, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => seekToWord(i)}
                    className={`inline-block cursor-pointer rounded px-0.5 transition-all duration-150 ${
                      i === wordIdx ? "scale-110 bg-brand-accent/70 font-bold text-ink" : ""
                    }`}
                  >
                    {w.word}&nbsp;
                  </button>
                ))
              : scene.narration}
          </p>
          {scene.timings.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-faint">{t("story.tapWordHint")}</p>
          )}
        </div>
      </div>

      {/* Audio element for the current scene */}
      <audio
        ref={audioRef}
        src={scene.audioUrl ?? undefined}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        preload="auto"
      />

      {/* Audio progress */}
      <div className="px-6">
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-soft">
          <div
            className="h-full rounded-full bg-brand-primary transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 px-4 py-5">
        <button
          onClick={goPrev}
          disabled={cur === 0}
          aria-label={t("story.prev")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-card text-xl text-ink ring-1 ring-black/[0.05] transition hover:bg-surface-soft active:scale-90 disabled:opacity-40"
        >
          ‹
        </button>
        <button
          onClick={togglePlay}
          disabled={!scene.audioUrl}
          aria-label={playing ? t("story.pause") : t("story.play")}
          className={`flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary text-2xl text-white shadow-md transition active:scale-90 disabled:opacity-50 ${
            playing ? "pulse-glow" : ""
          }`}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          onClick={goNext}
          aria-label={t("story.next")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-card text-xl text-ink ring-1 ring-black/[0.05] transition hover:bg-surface-soft active:scale-90"
        >
          ›
        </button>
      </div>

      {/* Page dots (tap to jump) */}
      <div className="pb-safe flex items-center justify-center gap-1.5">
        {scenes.map((s, i) => (
          <button
            key={s.index}
            onClick={() => setCur(i)}
            aria-label={`Adegan ${i + 1}`}
            aria-current={i === cur}
            className={`h-1.5 rounded-full transition-all ${
              i === cur ? "w-5 bg-brand-primary" : "w-1.5 bg-ink-faint/40 hover:bg-ink-faint/70"
            }`}
          />
        ))}
      </div>
    </main>
  );
}
