type JsonObject = Record<string, unknown>;

export type KieChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type KieChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | KieChatContentPart[];
};

export type KieTaskRecord = {
  taskId?: string;
  model?: string;
  state?: string;
  param?: string;
  resultJson?: string | JsonObject;
  failCode?: string | null;
  failMsg?: string | null;
  [key: string]: unknown;
};

const DEFAULT_API_BASE = "https://api.kie.ai";
const DEFAULT_HTTP_TIMEOUT_MS = 60_000;
const DEFAULT_TASK_TIMEOUT_MS = 55_000;
const DEFAULT_TASK_POLL_INTERVAL_MS = 2_000;
const DEFAULT_MAX_RETRIES = 2;

class KieRequestError extends Error {
  status?: number;
  code?: number;
  retryable: boolean;
  retryAfter: string | null;

  constructor(
    message: string,
    opts: { status?: number; code?: number; retryable?: boolean; retryAfter?: string | null } = {}
  ) {
    super(message);
    this.name = "KieRequestError";
    this.status = opts.status;
    this.code = opts.code;
    this.retryable = opts.retryable ?? false;
    this.retryAfter = opts.retryAfter ?? null;
  }
}

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

function envNumber(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getKieApiKey(): string {
  const key = process.env.KIE_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error(
      "KIE_API_KEY belum di-set. Ambil Bearer Token di https://kie.ai/api-key"
    );
  }
  return key.trim();
}

function apiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = env("KIE_API_BASE_URL", DEFAULT_API_BASE).replace(/\/$/, "");
  return `${base}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
}

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  }
  return Math.min(1_000 * 2 ** attempt, 6_000);
}

function stringifyDetail(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as JsonObject;
    const message =
      obj.message ??
      obj.msg ??
      obj.error ??
      (obj.data && typeof obj.data === "object" ? (obj.data as JsonObject).message : undefined);
    if (typeof message === "string") return message;
  }
  return JSON.stringify(value);
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  label: string,
  timeoutMs = envNumber("KIE_HTTP_TIMEOUT_MS", DEFAULT_HTTP_TIMEOUT_MS)
): Promise<T> {
  const maxRetries = envNumber("KIE_MAX_RETRIES", DEFAULT_MAX_RETRIES);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
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
        throw new KieRequestError(
          `${label} gagal (${res.status}): ${stringifyDetail(json || text).slice(0, 300)}`,
          {
            status: res.status,
            retryable: isRetryableStatus(res.status),
            retryAfter: res.headers.get("retry-after"),
          }
        );
      }

      if (
        json &&
        typeof json === "object" &&
        "code" in json &&
        Number((json as { code?: unknown }).code) !== 200 &&
        Number((json as { code?: unknown }).code) !== 0
      ) {
        const code = Number((json as { code?: unknown }).code);
        throw new KieRequestError(
          `${label} ditolak KIE (code ${code}): ${stringifyDetail(json).slice(0, 300)}`,
          {
            code,
            retryable: [408, 409, 425, 429, 500, 502, 503, 504].includes(code),
          }
        );
      }

      return json as T;
    } catch (error) {
      const retryable =
        error instanceof KieRequestError
          ? error.retryable
          : error instanceof Error && error.name === "AbortError";
      const retryAfter =
        error instanceof KieRequestError && error.status === 429 ? error.retryAfter : null;

      if (retryable && attempt < maxRetries) {
        await sleep(retryDelayMs(attempt, retryAfter));
        continue;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`${label} timeout setelah ${Math.round(timeoutMs / 1000)} detik.`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`${label} gagal setelah ${maxRetries + 1} percobaan.`);
}

function normalizeChatContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

export async function callKieChatCompletion(opts: {
  model: string;
  messages: KieChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const defaultEndpoint = `${env("KIE_API_BASE_URL", DEFAULT_API_BASE).replace(
    /\/$/,
    ""
  )}/gemini-3-flash/v1/chat/completions`;
  const endpoint = env(
    "KIE_GEMINI_CHAT_ENDPOINT",
    defaultEndpoint
  );

  const body: JsonObject = {
    model: opts.model,
    stream: false,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
  };

  if (opts.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const json = await fetchJson<{
    choices?: { message?: { content?: unknown }; delta?: { content?: unknown } }[];
    data?: { choices?: { message?: { content?: unknown } }[] };
  }>(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getKieApiKey()}`,
      },
      body: JSON.stringify(body),
    },
    "KIE Gemini 3 Flash",
    60_000
  );

  const content =
    json.choices?.[0]?.message?.content ??
    json.choices?.[0]?.delta?.content ??
    json.data?.choices?.[0]?.message?.content;

  const text = normalizeChatContent(content).trim();
  if (!text) throw new Error("KIE Gemini 3 Flash tidak mengembalikan teks.");
  return text;
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

export async function createKieTask(model: string, input: JsonObject): Promise<string> {
  const json = await fetchJson<{
    code?: number;
    msg?: string;
    data?: { taskId?: string; taskid?: string; id?: string };
    taskId?: string;
  }>(
    apiUrl("/api/v1/jobs/createTask"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getKieApiKey()}`,
      },
      body: JSON.stringify({ model, input }),
    },
    "KIE createTask",
    60_000
  );

  const taskId = json.data?.taskId ?? json.data?.taskid ?? json.data?.id ?? json.taskId;
  if (!taskId) {
    throw new Error(`KIE createTask tidak mengembalikan taskId: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return taskId;
}

export async function pollKieTask(
  taskId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<KieTaskRecord> {
  const timeoutMs = opts.timeoutMs ?? envNumber("KIE_TASK_TIMEOUT_MS", DEFAULT_TASK_TIMEOUT_MS);
  const intervalMs =
    opts.intervalMs ?? envNumber("KIE_TASK_POLL_INTERVAL_MS", DEFAULT_TASK_POLL_INTERVAL_MS);
  const started = Date.now();
  const successStates = new Set(["success", "succeeded", "completed", "complete"]);
  const failStates = new Set(["fail", "failed", "error", "canceled", "cancelled"]);

  while (Date.now() - started < timeoutMs) {
    const json = await fetchJson<{
      code?: number;
      msg?: string;
      data?: KieTaskRecord;
    }>(
      `${apiUrl("/api/v1/jobs/recordInfo")}?taskId=${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${getKieApiKey()}` },
      },
      "KIE recordInfo",
      30_000
    );

    const record = json.data ?? {};
    const state = String(record.state ?? "").toLowerCase();

    if (successStates.has(state)) return record;
    if (failStates.has(state)) {
      throw new Error(
        `KIE task gagal${record.failCode ? ` (${record.failCode})` : ""}: ${
          record.failMsg ?? json.msg ?? "Tidak ada detail error."
        }`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`KIE task ${taskId} belum selesai setelah ${Math.round(timeoutMs / 1000)} detik.`);
}

export function parseKieResultJson(record: KieTaskRecord): unknown {
  const raw = record.resultJson;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function collectDataUri(value: unknown, dataUris: string[]): void {
  if (!value) return;
  if (typeof value === "string") {
    if (/^data:[^;]+;base64,/i.test(value)) dataUris.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectDataUri(item, dataUris));
    return;
  }
  if (typeof value === "object") {
    for (const nested of Object.values(value as JsonObject)) collectDataUri(nested, dataUris);
  }
}

function collectUrl(value: unknown, urls: string[]): void {
  if (!value) return;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) urls.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUrl(item, urls));
    return;
  }
  if (typeof value === "object") {
    const obj = value as JsonObject;
    for (const key of [
      "mediaUrl",
      "url",
      "audioUrl",
      "imageUrl",
      "fileUrl",
      "downloadUrl",
      "src",
    ]) {
      collectUrl(obj[key], urls);
    }
    for (const nested of Object.values(obj)) collectUrl(nested, urls);
  }
}

export function extractKieMediaUrls(recordOrResult: KieTaskRecord | unknown): string[] {
  const result =
    recordOrResult && typeof recordOrResult === "object" && "resultJson" in recordOrResult
      ? parseKieResultJson(recordOrResult as KieTaskRecord)
      : recordOrResult;

  const urls: string[] = [];
  collectUrl(result, urls);
  return Array.from(new Set(urls));
}

export function extractKieDataUris(recordOrResult: KieTaskRecord | unknown): string[] {
  const result =
    recordOrResult && typeof recordOrResult === "object" && "resultJson" in recordOrResult
      ? parseKieResultJson(recordOrResult as KieTaskRecord)
      : recordOrResult;

  const dataUris: string[] = [];
  collectDataUri(result, dataUris);
  return Array.from(new Set(dataUris));
}

export function decodeDataUri(dataUri: string): { data: Uint8Array; mimeType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUri);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: Uint8Array.from(Buffer.from(match[2], "base64")),
  };
}

export async function fetchKieMedia(
  url: string,
  fallbackMimeType: string
): Promise<{ data: Uint8Array; mimeType: string }> {
  const maxRetries = envNumber("KIE_MAX_RETRIES", DEFAULT_MAX_RETRIES);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new KieRequestError(
          `Gagal mengambil media KIE (${res.status}): ${detail.slice(0, 200)}`,
          { status: res.status, retryable: isRetryableStatus(res.status) }
        );
      }
      const mimeType = res.headers.get("content-type")?.split(";")[0] || fallbackMimeType;
      return {
        data: Uint8Array.from(Buffer.from(await res.arrayBuffer())),
        mimeType,
      };
    } catch (error) {
      const retryable =
        error instanceof KieRequestError
          ? error.retryable
          : error instanceof TypeError || (error instanceof Error && error.name === "AbortError");
      if (retryable && attempt < maxRetries) {
        await sleep(retryDelayMs(attempt, null));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Gagal mengambil media KIE setelah ${maxRetries + 1} percobaan.`);
}
