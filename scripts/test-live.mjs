/**
 * Live smoke test for the AI pipeline — verifies your Google AI Studio key
 * works, WITHOUT needing Supabase or the full app.
 *
 *   1. Gemini text       -> structured story JSON
 *   2. Gemini image      -> scripts/out/scene.png
 *   3. Gemini TTS        -> scripts/out/scene.wav
 *
 * Usage:
 *   1. Put GEMINI_API_KEY in .env.local (see .env.example)
 *   2. npm run test:live
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(join(process.cwd(), ".env.local"));
loadEnv(join(process.cwd(), ".env"));

const OUT = join(process.cwd(), "scripts", "out");
mkdirSync(OUT, { recursive: true });

const API_BASE = (process.env.GOOGLE_AI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
const PURPOSES = ["story", "image", "audio"];
const apiKeyCursor = {
  story: Math.floor(Math.random() * 1000),
  image: Math.floor(Math.random() * 1000),
  audio: Math.floor(Math.random() * 1000),
};
const keyCooldownUntil = new Map();
const purposeNextRequestAt = { story: 0, image: 0, audio: 0 };
const defaultMinIntervalMs = { story: 1500, image: 6000, audio: 3000 };
const defaultRateLimitCooldownMs = { story: 12000, image: 18000, audio: 10000 };
const defaultBackoffJitter = 0.2;
const globalKeyPurposeOffset = { image: 0, story: 1, audio: 2 };
const STORY_MODEL = process.env.STORY_MODEL || "gemini-3.5-flash";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gemini-3.1-flash-lite-image";
const IMAGE_ASPECT_RATIO = process.env.IMAGE_ASPECT_RATIO || "4:3";
const TTS_MODEL = process.env.TTS_MODEL || "gemini-3.1-flash-tts-preview";
const TTS_VOICE = process.env.TTS_VOICE || "Kore";
const HTTP_TIMEOUT_MS = Number(process.env.GOOGLE_AI_HTTP_TIMEOUT_MS || "55000");
const MAX_RETRIES = Number(process.env.GOOGLE_AI_MAX_RETRIES || "2");

let sampleNarration = "Adit tersenyum dan berkata dengan lembut kepada temannya.";

const ok = (message) => console.log(`[ok] ${message}`);
const bad = (message) => console.log(`[fail] ${message}`);
const info = (message) => console.log(`  ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const retryableStatus = (status) => [408, 409, 425, 429, 500, 502, 503, 504].includes(status);

function envMs(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function envNumber(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function envBool(name, fallback) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "no", "off"].includes(value);
}

function envRatio(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 1) : fallback;
}

function splitApiKeys(value) {
  const trimmed = value?.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((key) => typeof key === "string" && key.trim());
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

function uniqueKeys(keys) {
  return [...new Set(keys)];
}

function numberedEnvNames(stems) {
  const stemOrder = new Map(stems.map((stem, index) => [stem, index]));
  const matches = [];

  for (const name of Object.keys(process.env)) {
    for (const stem of stems) {
      const prefix = `${stem}_`;
      if (!name.startsWith(prefix)) continue;
      const suffix = name.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) continue;
      matches.push({ name, number: Number(suffix), stemIndex: stemOrder.get(stem) || 0 });
      break;
    }
  }

  return matches
    .sort((a, b) => a.number - b.number || a.stemIndex - b.stemIndex || a.name.localeCompare(b.name))
    .map((match) => match.name);
}

function keysFromEnv(names, numberedStems = []) {
  const exact = names.flatMap((name) => splitApiKeys(process.env[name]));
  const numbered = numberedEnvNames(numberedStems).flatMap((name) =>
    splitApiKeys(process.env[name])
  );
  return uniqueKeys([...exact, ...numbered]);
}

function purposeApiKeyEnvConfig(purpose) {
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
    default:
      return { names: [], numberedStems: [] };
  }
}

function globalApiKeys() {
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

function getApiKeys(purpose) {
  const config = purposeApiKeyEnvConfig(purpose);
  const scoped = keysFromEnv(config.names, config.numberedStems);
  if (scoped.length) return scoped;

  const global = globalApiKeys();
  if (global.length >= 3 && envBool("GEMINI_API_KEYS_SPLIT_BY_PURPOSE", true)) {
    return global.filter((_, index) => index % 3 === globalKeyPurposeOffset[purpose]);
  }
  return global;
}

function orderedApiKeys(purpose, keys) {
  if (keys.length <= 1) return keys;
  const start = apiKeyCursor[purpose] % keys.length;
  apiKeyCursor[purpose] = (apiKeyCursor[purpose] + 1) % keys.length;
  return keys.map((_, index) => keys[(start + index) % keys.length]);
}

function shouldTryNextApiKey(status, json) {
  if (status === 429) return true;
  const text = JSON.stringify(json || "").toLowerCase();
  return /quota|rate.?limit|resource_exhausted|too many requests/.test(text);
}

function purposeEnvName(purpose, suffix) {
  return `GOOGLE_AI_${purpose.toUpperCase()}_${suffix}`;
}

function minIntervalMs(purpose) {
  return envMs(
    purposeEnvName(purpose, "MIN_INTERVAL_MS"),
    envMs("GOOGLE_AI_MIN_INTERVAL_MS", defaultMinIntervalMs[purpose])
  );
}

function maxBackoffMs() {
  return envMs("GOOGLE_AI_MAX_BACKOFF_MS", 45000);
}

function withJitter(ms) {
  if (ms <= 0) return 0;
  const ratio = envRatio("GOOGLE_AI_BACKOFF_JITTER", defaultBackoffJitter);
  if (ratio <= 0) return Math.round(ms);
  const delta = ms * ratio;
  return Math.max(0, Math.round(ms - delta + Math.random() * delta * 2));
}

function retryAfterMs(headers) {
  const value = headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

function rateLimitCooldownMs(purpose, headers, round) {
  const configured = envMs(
    purposeEnvName(purpose, "RATE_LIMIT_COOLDOWN_MS"),
    envMs("GOOGLE_AI_RATE_LIMIT_COOLDOWN_MS", defaultRateLimitCooldownMs[purpose])
  );
  const retryAfter = retryAfterMs(headers) || 0;
  return Math.min(withJitter(Math.max(retryAfter, configured * 2 ** round)), maxBackoffMs());
}

function transientBackoffMs(round) {
  return Math.min(withJitter(1000 * 2 ** round), maxBackoffMs());
}

function cooldownId(purpose, apiKey) {
  return `${purpose}:${apiKey}`;
}

function setApiKeyCooldown(purpose, apiKey, delayMs) {
  if (delayMs <= 0) return;
  const id = cooldownId(purpose, apiKey);
  keyCooldownUntil.set(id, Math.max(keyCooldownUntil.get(id) || 0, Date.now() + delayMs));
}

function activeApiKeys(purpose, keys) {
  const now = Date.now();
  return keys.filter((key) => (keyCooldownUntil.get(cooldownId(purpose, key)) || 0) <= now);
}

async function orderedAvailableApiKeys(purpose, keys) {
  const ordered = orderedApiKeys(purpose, keys);
  const active = activeApiKeys(purpose, ordered);
  if (active.length) return active;

  const now = Date.now();
  const earliest = Math.min(
    ...ordered.map((key) => keyCooldownUntil.get(cooldownId(purpose, key)) || now)
  );
  const waitMs = Math.min(Math.max(0, earliest - now), envMs("GOOGLE_AI_MAX_KEY_WAIT_MS", 25000));
  if (waitMs > 0) await sleep(waitMs);
  return activeApiKeys(purpose, ordered);
}

async function waitForPurposeSlot(purpose) {
  const waitMs = Math.max(0, purposeNextRequestAt[purpose] - Date.now());
  if (waitMs > 0) await sleep(waitMs);
  purposeNextRequestAt[purpose] = Date.now() + withJitter(minIntervalMs(purpose));
}

function headers(apiKey) {
  const h = {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };
  if (process.env.GOOGLE_AI_API_REVISION) {
    h["Api-Revision"] = process.env.GOOGLE_AI_API_REVISION;
  }
  return h;
}

async function interact(body, label, purpose) {
  const keyPool = getApiKeys(purpose);
  if (!keyPool.length) {
    throw new Error(`Tidak ada API key untuk ${purpose}. Isi GEMINI_API_KEY(S) atau GEMINI_${purpose.toUpperCase()}_API_KEYS.`);
  }
  const maxRounds = Math.max(1, envNumber("GOOGLE_AI_MAX_KEY_ROUNDS", MAX_RETRIES + 1));
  let lastKeyError = null;

  for (let round = 0; round < maxRounds; round++) {
    const keys = await orderedAvailableApiKeys(purpose, keyPool);
    if (!keys.length) continue;

    for (const apiKey of keys) {
      await waitForPurposeSlot(purpose);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
      try {
        const res = await fetch(`${API_BASE}/interactions`, {
          method: "POST",
          headers: headers(apiKey),
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await res.text();
        let json = {};
        if (text) {
          try {
            json = JSON.parse(text);
          } catch {
            json = { raw: text };
          }
        }

        if (!res.ok) {
          if (shouldTryNextApiKey(res.status, json)) {
            setApiKeyCooldown(purpose, apiKey, rateLimitCooldownMs(purpose, res.headers, round));
            lastKeyError = `${label} HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`;
            continue;
          }
          if (retryableStatus(res.status) && round < maxRounds - 1) {
            lastKeyError = `${label} HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`;
            await sleep(transientBackoffMs(round));
            continue;
          }
          throw new Error(`${label} HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
        }

        return json;
      } catch (error) {
        if (round < maxRounds - 1 && (error?.name === "AbortError" || error instanceof TypeError)) {
          lastKeyError = error?.message || String(error);
          await sleep(transientBackoffMs(round));
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  throw new Error(
    `${label} gagal: semua API key Gemini untuk ${purpose} sedang terkena quota/rate limit. ${
      lastKeyError || ""
    }`.trim()
  );
}

function outputText(json) {
  if (typeof json?.output_text === "string") return json.output_text;
  if (Array.isArray(json?.outputs)) {
    const chunks = json.outputs
      .filter((item) => item?.type === "text" && typeof item.text === "string")
      .map((item) => item.text);
    if (chunks.length) return chunks.join("");
  }
  if (Array.isArray(json?.steps)) {
    for (const step of [...json.steps].reverse()) {
      const chunks = collectTextContent(step?.content);
      if (chunks.length) return chunks.join("");
    }
  }
  return null;
}

function collectTextContent(value) {
  if (typeof value === "string" && value.trim()) return [value];
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectTextContent(item));
  if (typeof value !== "object") return [];
  const type = value.type;
  const text = value.text || value.data;
  if ((type === "text" || !type) && typeof text === "string" && text.trim()) return [text];
  return collectTextContent(value.content);
}

function dataUriMedia(value, kind) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match || !match[1].startsWith(`${kind}/`)) return null;
  return { mimeType: match[1], data: match[2] };
}

function mediaFromObject(value, kind, trusted = false) {
  const dataUri = dataUriMedia(value, kind);
  if (dataUri) return dataUri;
  if (!value || typeof value !== "object") return null;

  const data =
    value.data ||
    value.base64 ||
    value.bytes ||
    value[`${kind}Data`] ||
    value[`${kind}_data`] ||
    value[`${kind}Content`] ||
    value[`${kind}_content`];
  const mimeType =
    value.mime_type ||
    value.mimeType ||
    value.mime ||
    value.mediaType ||
    value.contentType ||
    (trusted ? (kind === "audio" ? "audio/pcm" : "image/png") : "");
  const type = value.type;

  if (typeof data === "string" && (type === kind || mimeType.startsWith(`${kind}/`) || trusted)) {
    return { data, mimeType: mimeType || (kind === "audio" ? "audio/pcm" : "image/png") };
  }
  return null;
}

function findNestedMedia(value, kind, trusted = false) {
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

  for (const [key, child] of Object.entries(value)) {
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

function outputMedia(json, kind) {
  const outputCamel = `output${kind[0].toUpperCase()}${kind.slice(1)}`;
  return (
    findNestedMedia(json?.[`output_${kind}`], kind, true) ||
    findNestedMedia(json?.[outputCamel], kind, true) ||
    findNestedMedia(json?.[kind], kind, true) ||
    findNestedMedia(json?.outputs, kind) ||
    findNestedMedia(json?.steps, kind) ||
    findNestedMedia(json?.candidates, kind)
  );
}

function parseJsonFromText(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("AI response is not valid JSON.");
  }
}

function hasRiffHeader(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
}

function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const storySchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          narration: { type: "string" },
          imagePrompts: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 3,
          },
        },
        required: ["narration", "imagePrompts"],
      },
    },
  },
  required: ["title", "scenes"],
};

async function testStory() {
  console.log("\n[1/3] Google AI Studio Gemini text");
  try {
    const json = await interact(
      {
        model: STORY_MODEL,
        input:
          "Buat cerita anak Islami singkat Bahasa Indonesia tentang Adit (laki-laki, 5 tahun) " +
          "belajar tidak mengejek teman. Tepat 3 adegan. Balas JSON valid.",
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: storySchema,
        },
        store: false,
      },
      "Gemini text",
      "story"
    );

    const text = outputText(json) || JSON.stringify(json);
    const data = parseJsonFromText(text);
    if (!data.scenes?.length) throw new Error("Tidak ada adegan di hasil.");
    sampleNarration = data.scenes[0].narration || sampleNarration;
    ok(`Model ${STORY_MODEL} OK - judul: "${data.title}", ${data.scenes.length} adegan.`);
    info(`Adegan 1: ${sampleNarration.slice(0, 90)}...`);
    return true;
  } catch (error) {
    bad(`Gagal: ${error?.message || error}`);
    return false;
  }
}

async function testImage() {
  console.log("\n[2/3] Google AI Studio Gemini image");
  try {
    const json = await interact(
      {
        model: IMAGE_MODEL,
        input:
          "Children's storybook illustration, soft warm colors, a cheerful 5 year old boy " +
          "smiling at a friend in a schoolyard. No text in the image.",
        response_format: {
          type: "image",
          aspect_ratio: IMAGE_ASPECT_RATIO,
        },
      },
      "Gemini image",
      "image"
    );

    const image = outputMedia(json, "image");
    if (!image?.data) throw new Error("Tidak ada image data di response.");
    const file = join(OUT, "scene.png");
    writeFileSync(file, Buffer.from(image.data, "base64"));
    ok(`Model ${IMAGE_MODEL} OK - gambar tersimpan: scripts/out/scene.png`);
    return true;
  } catch (error) {
    bad(`Gagal: ${error?.message || error}`);
    return false;
  }
}

async function testTts() {
  console.log("\n[3/3] Google AI Studio Gemini TTS");
  try {
    const json = await interact(
      {
        model: TTS_MODEL,
        input: `Bacakan narasi anak ini dalam Bahasa Indonesia dengan suara hangat dan jelas:\n\n${sampleNarration}`,
        response_format: { type: "audio" },
        generation_config: {
          speech_config: [{ voice: TTS_VOICE }],
        },
      },
      "Gemini TTS",
      "audio"
    );

    const audio = outputMedia(json, "audio");
    if (!audio?.data) throw new Error("Tidak ada audio data di response.");
    const raw = Buffer.from(audio.data, "base64");
    const wav = hasRiffHeader(raw) ? raw : pcmToWav(raw);
    writeFileSync(join(OUT, "scene.wav"), wav);
    ok(`Model ${TTS_MODEL}, voice ${TTS_VOICE} OK - audio tersimpan: scripts/out/scene.wav`);
    return true;
  } catch (error) {
    bad(`Gagal: ${error?.message || error}`);
    return false;
  }
}

if (PURPOSES.every((purpose) => getApiKeys(purpose).length === 0)) {
  bad("GEMINI_API_KEY atau GEMINI_API_KEYS tidak ada. Isi .env.local dulu.");
  process.exit(1);
}

const results = [];
results.push(["Cerita (Gemini text)", await testStory()]);
results.push(["Ilustrasi (Gemini image)", await testImage()]);
results.push(["Audio (Gemini TTS)", await testTts()]);

console.log("\n-------- Ringkasan --------");
for (const [name, pass] of results) {
  console.log(`${pass ? "[ok]" : "[fail]"} ${name}`);
}
const allPass = results.every(([, pass]) => pass);
console.log(
  allPass
    ? "\nSemua layanan Google AI Studio berfungsi. Cek scripts/out/ untuk hasil gambar & audio."
    : "\nSebagian gagal - lihat pesan di atas (biasanya GEMINI_API_KEY belum benar, model tidak tersedia, atau quota free tier habis)."
);
process.exit(allPass ? 0 : 1);
