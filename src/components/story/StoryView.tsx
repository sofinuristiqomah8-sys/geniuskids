"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { brand } from "../../../config/brand";
import { t, tArray } from "@/lib/i18n";
import type { StoryStatus, WordTiming } from "@/lib/database.types";

type SceneData = {
  index: number;
  narration: string | null;
  /** 2-3 sequential images per page; null slots are not generated yet. */
  imageUrls: (string | null)[];
  audioUrl: string | null;
  timings: WordTiming[];
};

export type StoryViewData = {
  id: string;
  status: StoryStatus;
  childName: string;
  title: string | null;
  opener: string | null;
  themeLabel: string | null;
  subThemeLabel: string | null;
  errorMessage: string | null;
  openerAudioUrl: string | null;
  openerTimings: WordTiming[];
  scenes: SceneData[];
};

type Step = "text" | "assets" | "audio" | "ready" | "error";
type ApiJson = Record<string, unknown>;

async function readApiJson(res: Response): Promise<ApiJson> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as ApiJson;
  } catch {
    return {
      error: text.replace(/\s+/g, " ").trim().slice(0, 300) || res.statusText,
    };
  }
}

function apiError(json: ApiJson, fallback: string) {
  return typeof json.error === "string" && json.error ? json.error : fallback;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function clientDelayMs(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

const IMAGE_STEP_DELAY_MS = clientDelayMs(
  process.env.NEXT_PUBLIC_GENERATE_IMAGE_STEP_DELAY_MS,
  2_500
);
const IMAGE_RETRY_LIMIT = clientDelayMs(
  process.env.NEXT_PUBLIC_GENERATE_IMAGE_RETRY_LIMIT,
  6
);
const IMAGE_RETRY_DELAY_MS = clientDelayMs(
  process.env.NEXT_PUBLIC_GENERATE_IMAGE_RETRY_DELAY_MS,
  9_000
);
const AUDIO_STEP_DELAY_MS = clientDelayMs(
  process.env.NEXT_PUBLIC_GENERATE_AUDIO_STEP_DELAY_MS,
  1_500
);
const AUDIO_RETRY_LIMIT = clientDelayMs(
  process.env.NEXT_PUBLIC_GENERATE_AUDIO_RETRY_LIMIT,
  10
);
const AUDIO_RETRY_DELAY_MS = clientDelayMs(
  process.env.NEXT_PUBLIC_GENERATE_AUDIO_RETRY_DELAY_MS,
  8_000
);

function retryDelayFrom(json: ApiJson, fallback: number): number {
  const raw = json.retryAfterMs;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** A placeholder SVG (saved during a past quota outage) is regenerable. */
function isPlaceholderImage(url: string | null): boolean {
  return !!url && url.split("?")[0].endsWith(".svg");
}

/** A sub-image slot still needs generating when it's empty or a placeholder. */
function slotNeedsImage(url: string | null): boolean {
  return !url || isPlaceholderImage(url);
}

/** Does any of a scene's 2-3 image slots still need generating? */
function sceneNeedsImages(scene: { imageUrls: (string | null)[] }): boolean {
  return scene.imageUrls.length === 0 || scene.imageUrls.some(slotNeedsImage);
}

/**
 * Generate one scene illustration, retrying while every image key is on
 * quota cooldown (the route answers 202 + retry). On the final attempt we let
 * the server persist a placeholder so a genuine outage still completes.
 */
async function postImageTask(
  storyId: string,
  index: number,
  imageIndex: number
): Promise<ApiJson> {
  for (let attempt = 0; attempt <= IMAGE_RETRY_LIMIT; attempt++) {
    const allowFallback = attempt >= IMAGE_RETRY_LIMIT;
    const res = await fetch(`/api/stories/${storyId}/generate-asset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index, imageIndex, kind: "image", allowFallback }),
    });
    const json = await readApiJson(res);

    if (res.status === 202 && json.retry === true && !allowFallback) {
      await wait(retryDelayFrom(json, IMAGE_RETRY_DELAY_MS));
      continue;
    }

    if (!res.ok) throw new Error(apiError(json, "Gagal membuat ilustrasi."));
    return json;
  }

  throw new Error("Ilustrasi masih antre. Coba lagi dalam beberapa saat.");
}

async function postAudioTask(
  storyId: string,
  task: { kind: "opener" } | { kind: "scene"; index: number }
): Promise<ApiJson> {
  for (let attempt = 0; attempt <= AUDIO_RETRY_LIMIT; attempt++) {
    const res = await fetch(`/api/stories/${storyId}/generate-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    const json = await readApiJson(res);

    if (res.status === 202 && json.retry === true) {
      if (attempt >= AUDIO_RETRY_LIMIT) {
        throw new Error(
          apiError(json, "Audio masih antre. Coba lagi dalam beberapa saat.")
        );
      }
      await wait(retryDelayFrom(json, AUDIO_RETRY_DELAY_MS));
      continue;
    }

    if (!res.ok) throw new Error(apiError(json, "Gagal membuat audio."));
    return json;
  }

  throw new Error("Audio masih antre. Coba lagi dalam beberapa saat.");
}

export default function StoryView({ data }: { data: StoryViewData }) {
  const [content, setContent] = useState({
    title: data.title,
    opener: data.opener,
    themeLabel: data.themeLabel,
    subThemeLabel: data.subThemeLabel,
  });
  const [scenes, setScenes] = useState<SceneData[]>(data.scenes);
  const [openerAudio, setOpenerAudio] = useState<string | null>(data.openerAudioUrl);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(data.errorMessage);

  const initialStep: Step =
    data.status === "error" && !data.title
      ? "error"
      : !data.title
        ? "text"
        : data.scenes.some((s) => sceneNeedsImages(s))
          ? "assets"
          : !data.openerAudioUrl || data.scenes.some((s) => !s.audioUrl)
            ? "audio"
            : "ready";
  const [step, setStep] = useState<Step>(initialStep);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (initialStep === "error" || initialStep === "ready") return;
    ranRef.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    setError(null);
    try {
      let localScenes = scenes;
      let localOpenerText = content.opener;

      // 1) Story text
      if (!content.title) {
        setStep("text");
        const res = await fetch(`/api/stories/${data.id}/generate-text`, { method: "POST" });
        const json = await readApiJson(res);
        if (!res.ok) throw new Error(apiError(json, "Gagal membuat cerita."));
        const generatedScenes = Array.isArray(json.scenes)
          ? json.scenes
              .map((s) => {
                if (!s || typeof s !== "object") return null;
                const scene = s as Record<string, unknown>;
                const count = Number(scene.imageCount);
                return {
                  index: Number(scene.index),
                  narration: optionalText(scene.narration),
                  imageCount: Number.isInteger(count) && count > 0 ? count : 1,
                };
              })
              .filter(
                (s): s is { index: number; narration: string | null; imageCount: number } =>
                  s !== null && Number.isInteger(s.index)
              )
          : [];
        if (generatedScenes.length === 0) {
          throw new Error("Cerita belum memiliki adegan. Coba generate ulang.");
        }
        setContent({
          title: optionalText(json.title),
          opener: optionalText(json.opener),
          themeLabel: optionalText(json.themeLabel),
          subThemeLabel: optionalText(json.subThemeLabel),
        });
        localOpenerText = optionalText(json.opener);
        localScenes = generatedScenes.map((s) => ({
          index: s.index,
          narration: s.narration,
          imageUrls: Array<string | null>(s.imageCount).fill(null),
          audioUrl: null,
          timings: [],
        }));
        setScenes(localScenes);
      }

      // 2) Illustrations (2-3 per page, sequential → progress). Empty slots and
      // placeholder SVGs are (re)generated so pages get real, continuous art.
      const imageTasks = localScenes.flatMap((s) =>
        s.imageUrls
          .map((url, imageIndex) => ({ index: s.index, imageIndex, url }))
          .filter((t) => slotNeedsImage(t.url))
      );
      if (imageTasks.length > 0) {
        setStep("assets");
        const totalSlots = localScenes.reduce((n, s) => n + s.imageUrls.length, 0);
        setProgress({ done: totalSlots - imageTasks.length, total: totalSlots });
        for (let i = 0; i < imageTasks.length; i++) {
          const task = imageTasks[i];
          const json = await postImageTask(data.id, task.index, task.imageIndex);
          const url = optionalText(json.imageUrl);
          setScenes((prev) =>
            prev.map((p) =>
              p.index === task.index
                ? {
                    ...p,
                    imageUrls: p.imageUrls.map((u, j) => (j === task.imageIndex ? url : u)),
                  }
                : p
            )
          );
          setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
          if (i < imageTasks.length - 1) await wait(IMAGE_STEP_DELAY_MS);
        }
      }

      // 3) Narration audio + word timings (opener first, then each scene)
      const audioTasks: Array<{ kind: "opener" } | { kind: "scene"; index: number }> = [];
      if (!openerAudio && localOpenerText) audioTasks.push({ kind: "opener" });
      for (const s of localScenes.filter((s) => !s.audioUrl)) {
        audioTasks.push({ kind: "scene", index: s.index });
      }
      if (audioTasks.length > 0) {
        setStep("audio");
        setProgress({ done: 0, total: audioTasks.length });
        for (let i = 0; i < audioTasks.length; i++) {
          const task = audioTasks[i];
          const json = await postAudioTask(data.id, task);
          if (task.kind === "opener") {
            setOpenerAudio(optionalText(json.audioUrl));
          } else {
            setScenes((prev) =>
              prev.map((p) =>
                p.index === task.index
                  ? {
                      ...p,
                      audioUrl: optionalText(json.audioUrl),
                      timings: Array.isArray(json.timings) ? (json.timings as WordTiming[]) : [],
                    }
                  : p
              )
            );
          }
          setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
          if (i < audioTasks.length - 1) await wait(AUDIO_STEP_DELAY_MS);
        }
      }

      setStep("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
      setStep("error");
    }
  }

  if (step === "error") {
    return (
      <Centered>
        <div className="text-5xl">😔</div>
        <h1 className="text-xl font-bold text-ink">Ada kendala saat membuat cerita</h1>
        <p className="max-w-xs text-sm text-ink-soft">{error}</p>
        <button
          onClick={() => {
            ranRef.current = true;
            void run();
          }}
          className="btn-primary mt-2"
        >
          Coba Lagi
        </button>
        <Link href="/create" className="btn-secondary">
          {t("wizard.back")}
        </Link>
      </Centered>
    );
  }

  if (step === "text") {
    return (
      <Loader
        title={t("generating.title")}
        subtitle={t("generating.forChild", { name: data.childName })}
      />
    );
  }

  if (step === "assets") {
    return (
      <Loader
        title={t("generating.preparingImages", { done: progress.done, total: progress.total })}
        subtitle={t("generating.drawingFor", { name: data.childName })}
        progress={progress}
      />
    );
  }

  if (step === "audio") {
    return (
      <Loader
        title={t("generating.preparingAudio", { done: progress.done, total: progress.total })}
        subtitle={t("generating.forChild", { name: data.childName })}
        progress={progress}
      />
    );
  }

  return (
    <OpenerView
      storyId={data.id}
      childName={data.childName}
      title={content.title}
      opener={content.opener}
      themeLabel={content.themeLabel}
      subThemeLabel={content.subThemeLabel}
      openerAudioUrl={openerAudio}
      sceneCount={scenes.length}
    />
  );
}

function Loader({
  title,
  subtitle,
  progress,
}: {
  title: string;
  subtitle?: string;
  progress?: { done: number; total: number };
}) {
  const facts = tArray("funFacts");
  const [factIdx, setFactIdx] = useState(0);
  useEffect(() => {
    if (facts.length < 2) return;
    const iv = setInterval(() => setFactIdx((i) => (i + 1) % facts.length), 3500);
    return () => clearInterval(iv);
  }, [facts.length]);

  const pct = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : null;

  return (
    <Centered>
      <div className="float mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-card text-3xl shadow-sm ring-1 ring-black/[0.04]">
        {brand.logoEmoji}
      </div>
      <h1 className="anim-fade-up text-xl font-extrabold text-ink">{title}</h1>
      <div className="my-3 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand-primary"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      {pct !== null && (
        <div className="mb-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-soft">
          <div
            className="relative h-full overflow-hidden rounded-full bg-brand-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          >
            <span className="shimmer absolute inset-0 rounded-full" />
          </div>
        </div>
      )}
      <div className="card anim-fade-in w-full max-w-xs px-4 py-3 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-primary">
          {t("generating.didYouKnow")}
        </p>
        <p className="mt-1 text-sm italic text-ink-soft">&ldquo;{facts[factIdx] ?? ""}&rdquo;</p>
      </div>
      {subtitle && <p className="mt-3 text-xs text-ink-faint">{subtitle}</p>}
    </Centered>
  );
}

function OpenerView({
  storyId,
  childName,
  title,
  opener,
  themeLabel,
  subThemeLabel,
  openerAudioUrl,
  sceneCount,
}: {
  storyId: string;
  childName: string;
  title: string | null;
  opener: string | null;
  themeLabel: string | null;
  subThemeLabel: string | null;
  openerAudioUrl: string | null;
  sceneCount: number;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initial = (childName?.[0] ?? "🙂").toUpperCase();

  function toggleOpenerAudio() {
    if (!openerAudioUrl) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    el.src = openerAudioUrl;
    el.onended = () => setPlaying(false);
    void el.play();
    setPlaying(true);
  }

  return (
    <div className="anim-fade-in mx-auto w-full max-w-md px-5 py-8">
      <div className="anim-fade-up rounded-card bg-gradient-to-b from-brand-primary/10 to-transparent p-6 text-center">
        <p className="anim-fade-up d1 text-xs font-semibold uppercase tracking-wide text-brand-primary">
          {t("story.opener")} · {sceneCount} adegan
        </p>
        <h1 className="anim-fade-up d2 mt-2 text-2xl font-extrabold text-ink">
          {title ?? "Cerita untuk " + childName}
        </h1>

        <div className="anim-pop breathe mx-auto my-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand-primary text-3xl font-extrabold text-white ring-4 ring-brand-accent/50">
          {initial}
        </div>

        {(themeLabel || subThemeLabel) && (
          <p className="mb-3 inline-block rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-ink-soft">
            {themeLabel}
            {subThemeLabel ? ` · ${subThemeLabel}` : ""}
          </p>
        )}

        {opener && <p className="text-left text-sm leading-relaxed text-ink-soft">{opener}</p>}

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={toggleOpenerAudio}
            disabled={!openerAudioUrl}
            className="btn-secondary w-full disabled:opacity-60"
          >
            {playing ? "⏸ Jeda" : `🔊 ${t("story.listenOpener")}`}
          </button>
          <Link href={`/story/${storyId}/read`} className="btn-primary pulse-glow w-full">
            {t("story.startStory")}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Fills the space under the app header (avoids nesting a second <main>). */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {children}
    </div>
  );
}
