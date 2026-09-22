type JsonObject = Record<string, unknown>;

export type GoogleInputPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string }
  | { type: "image"; uri: string; mime_type: string };

type GoogleMedia = {
  data: string;
  mimeType: string;
};

export type GoogleApiPurpose = "story" | "image" | "audio";

const DEFAULT_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_HTTP_TIMEOUT_MS: Record<GoogleApiPurpose, number> = {
  story: 55_000,
  image: 55_000,
  audio: 28_000,
};
const DEFAULT_MIN_INTERVAL_MS: Record<GoogleApiPurpose, number> = {
  story: 1_500,
  image: 6_000,
  audio: 3_000,
};
const DEFAULT_RATE_LIMIT_COOLDOWN_MS: Record<GoogleApiPurpose, number> = {
  story: 12_000,
  image: 18_000,
  audio: 10_000,
};
const DEFAULT_BACKOFF_JITTER = 0.2;
const GLOBAL_KEY_PURPOSE_OFFSET: Record<GoogleApiPurpose, number> = {
  image: 0,
  story: 1,
  audio: 2,
};
const PURPOSE_LABEL: Record<GoogleApiPurpose, string> = {
  story: "cerita",
  image: "gambar",
  audio: "audio",
};
const apiKeyCursor: Record<GoogleApiPurpose, number> = {
  story: Math.floor(Math.random() * 1000),
  image: Math.floor(Math.random() * 1000),
  audio: Math.floor(Math.random() * 1000),
};
const keyCooldownUntil = new Map<string, number>();
const purposeNextRequestAt: Record<GoogleApiPurpose, number> = {
  story: 0,
  image: 0,
  audio: 0,
};
const purposeLocks: Record<GoogleApiPurpose, Promise<void>> = {
  story: Promise.resolve(),
  image: Promise.resolve(),
  audio: Promise.resolve(),
};

export class GoogleAiRetryableError extends Error {
  retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = "GoogleAiRetryableError";
    this.retryAfterMs = retryAfterMs;
  }
}

export function isGoogleAiRetryableError(error: unknown): error is GoogleAiRetryableError {
  return error instanceof GoogleAiRetryableError;
}

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

function envNumber(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function envMs(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "no", "off"].includes(value);
}

function envRatio(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 1) : fallback;
}

function splitApiKeys(value: string | undefined): string[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((key): key is string => typeof key === "string" && key.trim() !== "");
      }
    } catch {
      // Fall back to delimiter parsing below.
    }
  }

  return trimmed
    .split(/[\s,;]+/)
    .map((key) => key.trim())
    .filter(Boolean);
}

function uniqueKeys(keys: string[]): string[] {
  return Array.from(new Set(keys));
}

function numberedEnvNames(stems: string[]): string[] {
  const stemOrder = new Map(stems.map((stem, index) => [stem, index]));
  const matches: Array<{ name: string; number: number; stemIndex: number }> = [];

  for (const name of Object.keys(process.env)) {
    for (const stem of stems) {
      const prefix = `${stem}_`;
      if (!name.startsWith(prefix)) continue;
      const suffix = name.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) continue;
      matches.push({
        name,
        number: Number(suffix),
        stemIndex: stemOrder.get(stem) ?? 0,
      });
      break;
    }
  }

  return matches
    .sort((a, b) => a.number - b.number || a.stemIndex - b.stemIndex || a.name.localeCompare(b.name))
    .map((match) => match.name);
}

function keysFromEnv(names: string[], numberedStems: string[] = []): string[] {
  const exact = names.flatMap((name) => splitApiKeys(process.env[name]));
  const numbered = numberedEnvNames(numberedStems).flatMap((name) =>
    splitApiKeys(process.env[name])
  );
  return uniqueKeys([...exact, ...numbered]);
}

function globalGeminiApiKeys(): string[] {
  return keysFromEnv(
    [
      "GEMINI_API_KEYS",
      "GOOGLE_GENERATIVE_AI_API_KEYS",
      "GOOGLE_AI_API_KEYS",
      "GEMINI_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "GOOGLE_AI_API_KEY",
      "GOOGLE_API_KEY",
    ],
    [
      "GEMINI_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "GOOGLE_AI_API_KEY",
      "GOOGLE_API_KEY",
    ]
  );
}

function purposeApiKeyEnvConfig(purpose: GoogleApiPurpose): {
  names: string[];
  numberedStems: string[];
} {
  switch (purpose) {
    case "story":
      return {
        names: [
          "GEMINI_STORY_API_KEYS",
          "GEMINI_TEXT_API_KEYS",
          "GOOGLE_AI_STORY_API_KEYS",
          "GOOGLE_AI_TEXT_API_KEYS",
          "GOOGLE_GENERATIVE_AI_STORY_API_KEYS",
          "GOOGLE_GENERATIVE_AI_TEXT_API_KEYS",
          "GEMINI_STORY_API_KEY",
          "GEMINI_TEXT_API_KEY",
          "GOOGLE_AI_STORY_API_KEY",
          "GOOGLE_AI_TEXT_API_KEY",
        ],
        numberedStems: [
          "GEMINI_STORY_API_KEY",
          "GEMINI_TEXT_API_KEY",
          "GOOGLE_AI_STORY_API_KEY",
          "GOOGLE_AI_TEXT_API_KEY",
          "GOOGLE_GENERATIVE_AI_STORY_API_KEY",
          "GOOGLE_GENERATIVE_AI_TEXT_API_KEY",
        ],
      };
    case "image":
      return {
        names: [
          "GEMINI_IMAGE_API_KEYS",
          "GOOGLE_AI_IMAGE_API_KEYS",
          "GOOGLE_GENERATIVE_AI_IMAGE_API_KEYS",
          "GEMINI_IMAGE_API_KEY",
          "GOOGLE_AI_IMAGE_API_KEY",
        ],
        numberedStems: [
          "GEMINI_IMAGE_API_KEY",
          "GOOGLE_AI_IMAGE_API_KEY",
          "GOOGLE_GENERATIVE_AI_IMAGE_API_KEY",
        ],
      };
    case "audio":
      return {
        names: [
          "GEMINI_AUDIO_API_KEYS",
          "GEMINI_TTS_API_KEYS",
          "GOOGLE_AI_AUDIO_API_KEYS",
          "GOOGLE_AI_TTS_API_KEYS",
          "GOOGLE_GENERATIVE_AI_AUDIO_API_KEYS",
          "GOOGLE_GENERATIVE_AI_TTS_API_KEYS",
          "GEMINI_AUDIO_API_KEY",
          "GEMINI_TTS_API_KEY",
          "GOOGLE_AI_AUDIO_API_KEY",
          "GOOGLE_AI_TTS_API_KEY",
        ],
        numberedStems: [
          "GEMINI_AUDIO_API_KEY",
          "GEMINI_TTS_API_KEY",
          "GOOGLE_AI_AUDIO_API_KEY",
          "GOOGLE_AI_TTS_API_KEY",
          "GOOGLE_GENERATIVE_AI_AUDIO_API_KEY",
          "GOOGLE_GENERATIVE_AI_TTS_API_KEY",
        ],
      };
  }
}

function splitGlobalKeysForPurpose(keys: string[], purpose: GoogleApiPurpose): string[] {
  const offset = GLOBAL_KEY_PURPOSE_OFFSET[purpose];
  return keys.filter((_, index) => index % 3 === offset);
}

function getGeminiApiKeys(purpose: GoogleApiPurpose): string[] {
  const config = purposeApiKeyEnvConfig(purpose);
  const scoped = keysFromEnv(config.names, config.numberedStems);
  if (scoped.length > 0) return scoped;

  const global = uniqueKeys(globalGeminiApiKeys());
  const shouldSplitGlobalPool =
    global.length >= 3 && envBool("GEMINI_API_KEYS_SPLIT_BY_PURPOSE", true);
  const keys = shouldSplitGlobalPool ? splitGlobalKeysForPurpose(global, purpose) : global;

  if (keys.length === 0) {
    throw new Error(
      `API key Gemini untuk ${PURPOSE_LABEL[purpose]} belum di-set. Isi GEMINI_API_KEY, GEMINI_API_KEYS, atau GEMINI_${purpose.toUpperCase()}_API_KEYS.`
    );
  }
  return keys;
}

function orderedApiKeys(purpose: GoogleApiPurpose, keys: string[]): string[] {
  if (keys.length <= 1) return keys;
  const start = apiKeyCursor[purpose] % keys.length;
  apiKeyCursor[purpose] = (apiKeyCursor[purpose] + 1) % keys.length;
  return keys.map((_, index) => keys[(start + index) % keys.length]);
}

function apiUrl(path: string): string {
  const base = env("GOOGLE_AI_API_BASE_URL", DEFAULT_API_BASE).replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryableStatus(status: number): boolean {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
}

function shouldTryNextApiKey(status: number, detail: unknown): boolean {
  if (status === 429) return true;
  const text = stringifyDetail(detail).toLowerCase();
  return /quota|rate.?limit|resource_exhausted|too many requests/.test(text);
}

function purposeEnvName(purpose: GoogleApiPurpose, suffix: string): string {
  return `GOOGLE_AI_${purpose.toUpperCase()}_${suffix}`;
}

function minIntervalMs(purpose: GoogleApiPurpose): number {
  return envMs(
    purposeEnvName(purpose, "MIN_INTERVAL_MS"),
    envMs("GOOGLE_AI_MIN_INTERVAL_MS", DEFAULT_MIN_INTERVAL_MS[purpose])
  );
}

function maxBackoffMs(): number {
  return envMs("GOOGLE_AI_MAX_BACKOFF_MS", 45_000);
}

function maxKeyWaitMs(purpose: GoogleApiPurpose): number {
  return envMs(
    purposeEnvName(purpose, "MAX_KEY_WAIT_MS"),
    envMs("GOOGLE_AI_MAX_KEY_WAIT_MS", purpose === "audio" ? 8_000 : 25_000)
  );
}

function failFastOnCooldown(purpose: GoogleApiPurpose): boolean {
  return envBool(purposeEnvName(purpose, "FAIL_FAST_ON_COOLDOWN"), purpose === "audio");
}

function failFastOnTransient(purpose: GoogleApiPurpose): boolean {
  return envBool(purposeEnvName(purpose, "FAIL_FAST_ON_TRANSIENT"), purpose === "audio");
}

function withJitter(ms: number): number {
  if (ms <= 0) return 0;
  const ratio = envRatio("GOOGLE_AI_BACKOFF_JITTER", DEFAULT_BACKOFF_JITTER);
  if (ratio <= 0) return Math.round(ms);
  const delta = ms * ratio;
  return Math.max(0, Math.round(ms - delta + Math.random() * delta * 2));
}

function retryAfterMs(headers: Headers): number | null {
  const value = headers.get("retry-after");
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

function rateLimitCooldownMs(
  purpose: GoogleApiPurpose,
  headers: Headers,
  round: number
): number {
  const configured = envMs(
    purposeEnvName(purpose, "RATE_LIMIT_COOLDOWN_MS"),
    envMs("GOOGLE_AI_RATE_LIMIT_COOLDOWN_MS", DEFAULT_RATE_LIMIT_COOLDOWN_MS[purpose])
  );
  const retryAfter = retryAfterMs(headers) ?? 0;
  const backoff = configured * 2 ** round;
  return Math.min(withJitter(Math.max(retryAfter, backoff)), maxBackoffMs());
}

function transientBackoffMs(round: number): number {
  return Math.min(withJitter(1_000 * 2 ** round), maxBackoffMs());
}

function cooldownId(purpose: GoogleApiPurpose, apiKey: string): string {
  return `${purpose}:${apiKey}`;
}

function setApiKeyCooldown(
  purpose: GoogleApiPurpose,
  apiKey: string,
  delayMs: number
): void {
  if (delayMs <= 0) return;
  const id = cooldownId(purpose, apiKey);
  const until = Date.now() + delayMs;
  keyCooldownUntil.set(id, Math.max(keyCooldownUntil.get(id) ?? 0, until));
}

function activeApiKeys(purpose: GoogleApiPurpose, keys: string[]): string[] {
  const now = Date.now();
  return keys.filter((key) => (keyCooldownUntil.get(cooldownId(purpose, key)) ?? 0) <= now);
}

async function orderedAvailableApiKeys(
  purpose: GoogleApiPurpose,
  keys: string[]
): Promise<{ keys: string[]; retryAfterMs: number | null }> {
  const ordered = orderedApiKeys(purpose, keys);
  const active = activeApiKeys(purpose, ordered);
  if (active.length > 0) return { keys: active, retryAfterMs: null };

  const now = Date.now();
  const earliest = Math.min(
    ...ordered.map((key) => keyCooldownUntil.get(cooldownId(purpose, key)) ?? now)
  );
  const maxWaitMs = maxKeyWaitMs(purpose);
  const waitMs = Math.min(Math.max(0, earliest - now), maxWaitMs);

  if (failFastOnCooldown(purpose)) {
    return { keys: [], retryAfterMs: Math.max(waitMs, minIntervalMs(purpose)) };
  }

  if (waitMs > 0) await sleep(waitMs);

  return { keys: activeApiKeys(purpose, ordered), retryAfterMs: null };
}

async function waitForPurposeSlot(purpose: GoogleApiPurpose): Promise<void> {
  const interval = minIntervalMs(purpose);
  if (interval <= 0) return;

  let release: () => void = () => {};
  const previous = purposeLocks[purpose];
  purposeLocks[purpose] = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    const now = Date.now();
    const waitMs = Math.max(0, purposeNextRequestAt[purpose] - now);
    if (waitMs > 0) await sleep(waitMs);
    purposeNextRequestAt[purpose] = Date.now() + withJitter(interval);
  } finally {
    release();
  }
}

function stringifyDetail(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as JsonObject;
    const message =
      obj.message ??
      obj.error ??
      obj.status ??
      (obj.error && typeof obj.error === "object"
        ? (obj.error as JsonObject).message
        : undefined);
    if (typeof message === "string") return message;
  }
  return JSON.stringify(value);
}

async function fetchGoogleJson<T>(
  body: JsonObject,
  label: string,
  purpose: GoogleApiPurpose,
  timeoutMs = envNumber(
    purposeEnvName(purpose, "HTTP_TIMEOUT_MS"),
    envNumber("GOOGLE_AI_HTTP_TIMEOUT_MS", DEFAULT_HTTP_TIMEOUT_MS[purpose])
  )
): Promise<T> {
  const maxRetries = envNumber("GOOGLE_AI_MAX_RETRIES", DEFAULT_MAX_RETRIES);
  const maxRounds = Math.max(1, envNumber("GOOGLE_AI_MAX_KEY_ROUNDS", maxRetries + 1));
  const keyPool = getGeminiApiKeys(purpose);
  let lastKeyError: Error | null = null;

  for (let round = 0; round < maxRounds; round++) {
    const available = await orderedAvailableApiKeys(purpose, keyPool);
    const keys = available.keys;
    if (keys.length === 0) {
      if (available.retryAfterMs != null) {
        throw new GoogleAiRetryableError(
          `${label} menunggu cooldown API key Gemini untuk ${PURPOSE_LABEL[purpose]}.`,
          available.retryAfterMs
        );
      }
      continue;
    }

    for (const apiKey of keys) {
      await waitForPurposeSlot(purpose);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        };
        const revision = process.env.GOOGLE_AI_API_REVISION?.trim();
        if (revision) headers["Api-Revision"] = revision;

        const res = await fetch(apiUrl("/interactions"), {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await res.text();
        let json: unknown = {};
        if (text) {
          try {
            json = JSON.parse(text);
          } catch {
            json = { raw: text };
          }
        }

        if (!res.ok) {
          const detail = stringifyDetail(json || text).slice(0, 300);

          if (shouldTryNextApiKey(res.status, json || text)) {
            const cooldown = rateLimitCooldownMs(purpose, res.headers, round);
            setApiKeyCooldown(purpose, apiKey, cooldown);
            lastKeyError = new Error(`${label} gagal (${res.status}): ${detail}`);
            continue;
          }

          if (retryableStatus(res.status) && round < maxRounds - 1) {
            lastKeyError = new Error(`${label} gagal (${res.status}): ${detail}`);
            await sleep(transientBackoffMs(round));
            continue;
          }
          throw new Error(`${label} gagal (${res.status}): ${detail}`);
        }

        return json as T;
      } catch (error) {
        const retryable =
          error instanceof Error && (error.name === "AbortError" || error instanceof TypeError);
        if (retryable && round < maxRounds - 1) {
          lastKeyError = error instanceof Error ? error : new Error(String(error));
          if (failFastOnTransient(purpose)) {
            throw new GoogleAiRetryableError(
              `${label} belum siap, akan dicoba lagi sebentar lagi.`,
              transientBackoffMs(round)
            );
          }
          await sleep(transientBackoffMs(round));
          continue;
        }
        if (error instanceof Error && error.name === "AbortError") {
          throw new GoogleAiRetryableError(
            `${label} timeout setelah ${Math.round(timeoutMs / 1000)} detik.`,
            transientBackoffMs(round)
          );
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  throw new Error(
    `${label} gagal: semua API key Gemini untuk ${PURPOSE_LABEL[purpose]} sedang terkena quota/rate limit. ${
      lastKeyError?.message ?? ""
    }`.trim()
  );
}

function firstString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as JsonObject;
  for (const key of keys) {
    const child = obj[key];
    if (typeof child === "string" && child.trim() !== "") return child;
  }
  return null;
}

function extractOutputText(json: unknown): string | null {
  const direct = firstString(json, ["output_text", "outputText", "text"]);
  if (direct) return direct;

  if (json && typeof json === "object") {
    const obj = json as JsonObject;
    const outputs = obj.outputs;
    if (Array.isArray(outputs)) {
      const chunks = outputs
        .map((item) =>
          item && typeof item === "object" && (item as JsonObject).type === "text"
            ? firstString(item, ["text", "data"])
            : null
        )
        .filter((item): item is string => Boolean(item));
      if (chunks.length > 0) return chunks.join("");
    }

    const steps = obj.steps;
    if (Array.isArray(steps)) {
      for (const step of [...steps].reverse()) {
        if (!step || typeof step !== "object") continue;
        const content = (step as JsonObject).content;
        const chunks = collectTextContent(content);
        if (chunks.length > 0) return chunks.join("");
      }
    }
  }

  return null;
}

function collectTextContent(value: unknown): string[] {
  if (typeof value === "string" && value.trim() !== "") return [value];
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextContent(item));
  }
  if (typeof value !== "object") return [];

  const obj = value as JsonObject;
  const type = firstString(obj, ["type"]);
  const text = firstString(obj, ["text", "data"]);
  if ((type === "text" || !type) && text) return [text];

  return collectTextContent(obj.content);
}

function dataUriMedia(value: string, kind: "image" | "audio"): GoogleMedia | null {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match || !match[1].startsWith(`${kind}/`)) return null;
  return { mimeType: match[1], data: match[2] };
}

function mediaFromObject(
  value: unknown,
  kind: "image" | "audio",
  trusted = false
): GoogleMedia | null {
  if (typeof value === "string") return dataUriMedia(value, kind);
  if (!value || typeof value !== "object") return null;
  const obj = value as JsonObject;
  const data = firstString(obj, [
    "data",
    "base64",
    "bytes",
    `${kind}Data`,
    `${kind}_data`,
    `${kind}Content`,
    `${kind}_content`,
  ]);
  const mimeType =
    firstString(obj, ["mime_type", "mimeType", "mime", "mediaType", "contentType"]) ??
    (trusted ? (kind === "audio" ? "audio/pcm" : "image/png") : "");
  const type = firstString(obj, ["type"]);

  if (data && (type === kind || mimeType.startsWith(`${kind}/`) || trusted)) {
    return {
      data,
      mimeType: mimeType || (kind === "audio" ? "audio/pcm" : "image/png"),
    };
  }
  return null;
}

function findNestedMedia(value: unknown, kind: "image" | "audio", trusted = false): GoogleMedia | null {
  const direct = mediaFromObject(value, kind, trusted);
  if (direct) return direct;

  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const media = findNestedMedia(item, kind, trusted);
      if (media) return media;
    }
    return null;
  }

  const obj = value as JsonObject;
  for (const [key, child] of Object.entries(obj)) {
    const childTrusted =
      trusted ||
      key === kind ||
      key === `output_${kind}` ||
      key === `output${kind[0].toUpperCase()}${kind.slice(1)}` ||
      key === `${kind}Data` ||
      key === `${kind}_data` ||
      key === `${kind}Content` ||
      key === `${kind}_content` ||
      key === "inlineData" ||
      key === "inline_data" ||
      key === "delta";
    const media = findNestedMedia(child, kind, childTrusted);
    if (media) return media;
  }

  return null;
}

function extractOutputMedia(json: unknown, kind: "image" | "audio"): GoogleMedia | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as JsonObject;
  const outputCamel = `output${kind[0].toUpperCase()}${kind.slice(1)}`;
  const direct =
    findNestedMedia(obj[`output_${kind}`], kind, true) ??
    findNestedMedia(obj[outputCamel], kind, true) ??
    findNestedMedia(obj[kind], kind, true);
  if (direct) return direct;

  const outputs = obj.outputs;
  if (Array.isArray(outputs)) {
    for (const output of outputs) {
      const media = findNestedMedia(output, kind);
      if (media) return media;
    }
  }

  return findNestedMedia(obj.steps, kind) ?? findNestedMedia(obj.candidates, kind);
}

function summarizeResponseShape(value: unknown, depth = 0): string {
  if (!value || typeof value !== "object") return typeof value;
  if (depth >= 3) return Array.isArray(value) ? "array" : "object";
  if (Array.isArray(value)) {
    return `[${value.length ? summarizeResponseShape(value[0], depth + 1) : ""}]`;
  }

  const obj = value as JsonObject;
  const entries = Object.keys(obj)
    .slice(0, 8)
    .map((key) => {
      const child = obj[key];
      if (typeof child === "string") return `${key}:string`;
      return `${key}:${summarizeResponseShape(child, depth + 1)}`;
    });
  return `{${entries.join(",")}}`;
}

function decodeBase64(data: string): Uint8Array {
  return Uint8Array.from(Buffer.from(data, "base64"));
}

function hasRiffHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  );
}

function pcmToWav(
  pcm: Uint8Array,
  opts: { sampleRate?: number; channels?: number; bitsPerSample?: number } = {}
): Uint8Array {
  const sampleRate = opts.sampleRate ?? 24_000;
  const channels = opts.channels ?? 1;
  const bitsPerSample = opts.bitsPerSample ?? 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  function writeString(offset: number, value: string) {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, pcm.byteLength, true);

  const wav = new Uint8Array(44 + pcm.byteLength);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav;
}

async function referenceToImagePart(
  reference: { url: string } | { base64: string; mimeType: string }
): Promise<GoogleInputPart> {
  if ("base64" in reference) {
    return { type: "image", data: reference.base64, mime_type: reference.mimeType };
  }

  const res = await fetch(reference.url);
  if (!res.ok) {
    throw new Error(`Gagal membaca gambar referensi (${res.status}).`);
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return {
    type: "image",
    data: Buffer.from(await res.arrayBuffer()).toString("base64"),
    mime_type: mimeType,
  };
}

export async function callGoogleText(opts: {
  model: string;
  input: string | GoogleInputPart[];
  temperature?: number;
  maxTokens?: number;
  responseJsonSchema?: JsonObject;
  purpose?: GoogleApiPurpose;
}): Promise<string> {
  const responseFormat = opts.responseJsonSchema
    ? {
        type: "text",
        mime_type: "application/json",
        schema: opts.responseJsonSchema,
      }
    : { type: "text" };

  const json = await fetchGoogleJson<JsonObject>(
    {
      model: opts.model,
      input: opts.input,
      response_format: responseFormat,
      generation_config: {
        temperature: opts.temperature ?? 0.7,
      },
      store: false,
    },
    "Google AI Studio",
    opts.purpose ?? "story"
  );

  const text = extractOutputText(json);
  if (text) return text.trim();

  // Structured-output REST responses can be returned directly as JSON.
  if (opts.responseJsonSchema && json && typeof json === "object") {
    return JSON.stringify(json);
  }

  throw new Error("Google AI Studio tidak mengembalikan teks.");
}

export async function generateGoogleImage(opts: {
  model: string;
  prompt: string;
  aspectRatio: string;
  /** Output resolution tier (e.g. "1K"/"2K"/"4K"). "1K" keeps cost lowest. */
  resolution?: string;
  reference?: { url: string } | { base64: string; mimeType: string };
}): Promise<{ data: Uint8Array; mimeType: string }> {
  const input: GoogleInputPart[] = [{ type: "text", text: opts.prompt }];
  if (opts.reference) {
    try {
      input.push(await referenceToImagePart(opts.reference));
    } catch {
      // Reference photos are best-effort; the prompt still contains the look.
    }
  }

  const responseFormat: JsonObject = {
    type: "image",
    aspect_ratio: opts.aspectRatio,
  };
  // Cap resolution so higher-cost 2K/4K tiers aren't billed unless asked for.
  if (opts.resolution) responseFormat.resolution = opts.resolution;

  const json = await fetchGoogleJson<JsonObject>(
    {
      model: opts.model,
      input,
      response_format: responseFormat,
    },
    "Google AI Studio image",
    "image"
  );

  const image = extractOutputMedia(json, "image");
  if (!image) throw new Error("Google AI Studio tidak mengembalikan gambar.");

  return {
    data: decodeBase64(image.data),
    mimeType: image.mimeType || "image/png",
  };
}

export async function synthesizeGoogleSpeech(opts: {
  model: string;
  text: string;
  voice: string;
}): Promise<{ audio: Uint8Array; mimeType: string }> {
  const json = await fetchGoogleJson<JsonObject>(
    {
      model: opts.model,
      input: `Bacakan narasi anak ini dalam Bahasa Indonesia dengan suara hangat, jelas, dan natural:\n\n${opts.text}`,
      response_format: { type: "audio" },
      generation_config: {
        speech_config: [{ voice: opts.voice }],
      },
    },
    "Google AI Studio TTS",
    "audio"
  );

  const audio = extractOutputMedia(json, "audio");
  if (!audio) {
    const text = extractOutputText(json);
    const detail = text
      ? ` Response teks: ${text.slice(0, 180)}`
      : ` Bentuk response: ${summarizeResponseShape(json)}`;
    throw new Error(`Google AI Studio tidak mengembalikan audio.${detail}`);
  }

  const decoded = decodeBase64(audio.data);
  if (audio.mimeType.includes("wav") || hasRiffHeader(decoded)) {
    return { audio: decoded, mimeType: "audio/wav" };
  }

  return { audio: pcmToWav(decoded), mimeType: "audio/wav" };
}

export function parseJsonFromText<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("Format JSON dari AI tidak valid.");
  }
}
