import { providers } from "../../../config/providers";
import type { WordTiming } from "../database.types";
import { synthesizeGoogleSpeech } from "./google";
import {
  createKieTask,
  decodeDataUri,
  extractKieDataUris,
  extractKieMediaUrls,
  fetchKieMedia,
  parseKieResultJson,
  pollKieTask,
} from "./kie";

export type Synthesized = {
  audio: Uint8Array;
  mimeType: string;
  /** Per-word karaoke timings aligned to the audio. */
  timings: WordTiming[];
};

/** Split narration into display tokens (words with attached punctuation). */
function tokenize(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 0);
}

/**
 * Synthesize narration to audio + word timings.
 * Word timings come from the provider when available, with an estimated
 * fallback for karaoke display.
 */
export async function synthesizeNarration(text: string): Promise<Synthesized> {
  switch (providers.tts.provider) {
    case "google":
      return synthesizeGoogleTts(text);
    case "elevenlabs":
      return synthesizeElevenLabs(text);
    default:
      throw new Error(
        `Provider TTS "${providers.tts.provider}" belum didukung. Gunakan TTS_PROVIDER=google.`
      );
  }
}

async function synthesizeGoogleTts(text: string): Promise<Synthesized> {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    throw new Error("Tidak ada teks untuk disintesis.");
  }

  const synth = await synthesizeGoogleSpeech({
    model: providers.tts.model,
    text,
    voice: providers.tts.voice,
  });

  return {
    audio: synth.audio,
    mimeType: synth.mimeType,
    timings: estimateWordTimings(tokens),
  };
}

async function synthesizeElevenLabs(text: string): Promise<Synthesized> {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    throw new Error("Tidak ada teks untuk disintesis.");
  }

  const taskId = await createKieTask(providers.tts.model, {
    text,
    voice: providers.tts.voice,
    stability: providers.tts.stability,
    similarity_boost: providers.tts.similarityBoost,
    style: providers.tts.style,
    speed: providers.tts.speakingRate,
    timestamps: true,
    language_code: providers.tts.languageCode,
    nsfw_checker: true,
  });

  const record = await pollKieTask(taskId);
  const result = parseKieResultJson(record);
  const [url] = extractKieMediaUrls(record);

  if (!url) {
    const [dataUri] = extractKieDataUris(record);
    const decoded = dataUri ? decodeDataUri(dataUri) : null;
    if (decoded) {
      return {
        audio: decoded.data,
        mimeType: decoded.mimeType,
        timings: extractWordTimings(result, text) ?? estimateWordTimings(tokens),
      };
    }

    const embedded = extractEmbeddedAudio(result);
    if (embedded) {
      return {
        ...embedded,
        timings: extractWordTimings(result, text) ?? estimateWordTimings(tokens),
      };
    }
    throw new Error("ElevenLabs tidak mengembalikan URL audio.");
  }

  const audio = await fetchKieMedia(url, "audio/mpeg");
  return {
    audio: audio.data,
    mimeType: audio.mimeType,
    timings: extractWordTimings(result, text) ?? estimateWordTimings(tokens),
  };
}

function extractEmbeddedAudio(result: unknown): { audio: Uint8Array; mimeType: string } | null {
  const found = findStringByKey(result, new Set(["audio_base64", "audioBase64", "audioContent"]));
  if (!found) return null;
  return {
    audio: Uint8Array.from(Buffer.from(found, "base64")),
    mimeType: "audio/mpeg",
  };
}

function findStringByKey(value: unknown, keys: Set<string>): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, keys);
      if (found) return found;
    }
    return null;
  }

  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const child = obj[key];
    if (keys.has(key) && typeof child === "string") return child;
    const found = findStringByKey(child, keys);
    if (found) return found;
  }
  return null;
}

function extractWordTimings(result: unknown, originalText: string): WordTiming[] | null {
  return (
    extractWordArrayTimings(result) ??
    extractAlignmentTimings(findAlignmentObject(result), originalText)
  );
}

function extractWordArrayTimings(value: unknown): WordTiming[] | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    const timings = wordsFromEntries(value);
    if (timings) return timings;
    for (const item of value) {
      const nested = extractWordArrayTimings(item);
      if (nested) return nested;
    }
    return null;
  }

  const obj = value as Record<string, unknown>;
  for (const key of ["words", "word_timestamps", "wordTimestamps", "timestamps"]) {
    const child = obj[key];
    if (Array.isArray(child)) {
      const timings = wordsFromEntries(child);
      if (timings) return timings;
    }
  }
  for (const child of Object.values(obj)) {
    const nested = extractWordArrayTimings(child);
    if (nested) return nested;
  }
  return null;
}

function wordsFromEntries(entries: unknown[]): WordTiming[] | null {
  const timings = entries
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const obj = entry as Record<string, unknown>;
      const word = firstString(obj, ["word", "text", "value", "token"]);
      const start = firstNumberWithUnit(obj, [
        "startMs",
        "start_ms",
        "start",
        "start_time",
        "startTime",
      ]);
      const end = firstNumberWithUnit(obj, ["endMs", "end_ms", "end", "end_time", "endTime"]);
      if (!word || start == null || end == null) return null;
      const startMs = Math.round(start.unit === "ms" ? start.value : start.value * 1000);
      const endMs = Math.round(end.unit === "ms" ? end.value : end.value * 1000);
      return { word, startMs, endMs };
    })
    .filter((entry): entry is WordTiming => Boolean(entry));

  return timings.length > 0 ? timings : null;
}

function findAlignmentObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAlignmentObject(item);
      if (found) return found;
    }
    return null;
  }

  const obj = value as Record<string, unknown>;
  if (
    (Array.isArray(obj.characters) || Array.isArray(obj.chars)) &&
    (Array.isArray(obj.character_start_times_seconds) ||
      Array.isArray(obj.character_start_times_ms) ||
      Array.isArray(obj.char_start_times_ms))
  ) {
    return obj;
  }

  for (const key of ["normalized_alignment", "alignment", "normalizedAlignment"]) {
    const child = obj[key];
    const found = findAlignmentObject(child);
    if (found) return found;
  }
  for (const child of Object.values(obj)) {
    const found = findAlignmentObject(child);
    if (found) return found;
  }
  return null;
}

function extractAlignmentTimings(
  alignment: Record<string, unknown> | null,
  originalText: string
): WordTiming[] | null {
  if (!alignment) return null;
  const chars = asStringArray(alignment.characters ?? alignment.chars);
  const startsSource =
    alignment.character_start_times_seconds ??
    alignment.character_start_times_ms ??
    alignment.char_start_times_ms;
  const startsInMs =
    Array.isArray(alignment.character_start_times_ms) ||
    Array.isArray(alignment.char_start_times_ms);
  const starts = asNumberArray(startsSource)?.map((n) => n * (startsInMs ? 1 : 1000));

  const endsSource = alignment.character_end_times_seconds ?? alignment.character_end_times_ms;
  const endsInMs = Array.isArray(alignment.character_end_times_ms);
  const ends =
    asNumberArray(endsSource)?.map((n) => n * (endsInMs ? 1 : 1000)) ??
    durationsToEnds(
      starts ?? null,
      asNumberArray(alignment.character_durations_seconds ?? alignment.character_durations_ms)?.map(
        (n) => n * (Array.isArray(alignment.character_durations_ms) ? 1 : 1000)
      ) ?? null
    );

  if (!chars || !starts || !ends || chars.length === 0) return null;
  const timings: WordTiming[] = [];
  let word = "";
  let startMs = 0;
  let endMs = 0;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (/\s/.test(ch)) {
      if (word) {
        timings.push({ word, startMs, endMs });
        word = "";
      }
      continue;
    }
    if (!word) startMs = Math.round(starts[i] ?? 0);
    word += ch;
    endMs = Math.round(Math.max(ends[i] ?? starts[i] ?? 0, starts[i] ?? 0));
  }

  if (word) timings.push({ word, startMs, endMs });
  if (timings.length > 0) return timings;

  const tokens = tokenize(originalText);
  return tokens.length > 0 ? estimateWordTimings(tokens) : null;
}

function durationsToEnds(starts: number[] | null, durations: number[] | null): number[] | null {
  if (!starts || !durations) return null;
  return starts.map((start, i) => start + (durations[i] ?? 0));
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((item) => String(item));
}

function asNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const numbers = value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  return numbers.length > 0 ? numbers : null;
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function firstNumberWithUnit(
  obj: Record<string, unknown>,
  keys: string[]
): { value: number; unit: "ms" | "s" } | null {
  for (const key of keys) {
    const value = Number(obj[key]);
    if (Number.isFinite(value)) {
      const lower = key.toLowerCase();
      return { value, unit: lower.includes("ms") ? "ms" : "s" };
    }
  }
  return null;
}

function estimateWordTimings(tokens: string[]): WordTiming[] {
  let cursor = 0;
  return tokens.map((word) => {
    const duration = Math.max(220, Math.min(720, 190 + word.length * 38));
    const startMs = cursor;
    const endMs = cursor + Math.round(duration / Math.max(providers.tts.speakingRate, 0.7));
    cursor = endMs + 35;
    return { word, startMs, endMs };
  });
}
