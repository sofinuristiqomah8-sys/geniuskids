import { providers } from "../../../config/providers";
import { callGoogleText, generateGoogleImage } from "./google";
import {
  callKieChatCompletion,
  createKieTask,
  decodeDataUri,
  extractKieDataUris,
  extractKieMediaUrls,
  fetchKieMedia,
  pollKieTask,
} from "./kie";

/**
 * Analyze the child's photo once to produce a short, reusable look description
 * that keeps illustrations consistent across every scene. Identity/name is not
 * requested — only visual traits (skin tone, hair, face shape).
 */
export async function analyzeChildPhoto(
  base64: string,
  mimeType: string
): Promise<string> {
  const prompt =
    "Lihat foto anak ini. Tuliskan deskripsi penampilan fisiknya secara singkat dan " +
    "spesifik untuk menjaga konsistensi ilustrasi buku cerita: perkiraan warna kulit, " +
    "warna & gaya rambut, bentuk wajah, dan ciri khas lainnya. Jangan menyebut nama atau " +
    "identitas. Jawab dalam 1-2 kalimat Bahasa Indonesia.";

  let text: string;
  if (providers.story.provider === "gemini") {
    text = await callGoogleText({
      model: providers.story.model,
      input: [
        { type: "text", text: prompt },
        { type: "image", data: base64, mime_type: mimeType },
      ],
      temperature: 0.2,
      maxTokens: 512,
    });
  } else if (providers.story.provider === "kie") {
    text = await callKieChatCompletion({
      model: providers.story.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      temperature: 0.2,
      maxTokens: 512,
    });
  } else {
    throw new Error(`Provider analisa foto "${providers.story.provider}" belum didukung.`);
  }

  return text.trim();
}

export type SceneImage = { data: Uint8Array; mimeType: string };

type Reference = { url: string } | { base64: string; mimeType: string };

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (!v) return fallback;
  return !["0", "false", "no", "off"].includes(v);
}

function isImageQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(429|quota|rate.?limit|resource_exhausted|too many requests)/i.test(message);
}

/**
 * KIE Nano Banana is a generous free-tier image model (new accounts get free
 * credits). We use it whenever `IMAGE_PROVIDER=kie`, and — unless disabled — as
 * an automatic *free overflow* when the primary Gemini image quota is exhausted,
 * so scenes still get real art instead of a placeholder.
 * Docs: https://docs.kie.ai/market/google/nano-banana
 */
function kieFallbackEnabled(): boolean {
  return (
    !!process.env.KIE_API_KEY?.trim() &&
    envBool("IMAGE_KIE_FALLBACK", true) &&
    providers.image.provider !== "kie"
  );
}

async function generateKieImage(opts: {
  model: string;
  prompt: string;
  aspectRatio: string;
  reference?: Reference;
}): Promise<SceneImage> {
  const imageUrls: string[] = [];
  if (opts.reference) {
    imageUrls.push(
      "url" in opts.reference
        ? opts.reference.url
        : `data:${opts.reference.mimeType};base64,${opts.reference.base64}`
    );
  }

  // Nano Banana's job schema expects `image_size` (aspect ratio), `resolution`
  // (1K/2K/4K — 1K is cheapest/free-friendly) and `output_format`; `image_urls`
  // is only for reference/image-to-image runs.
  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    image_size: opts.aspectRatio,
    resolution: providers.image.resolution,
    output_format: "png",
  };
  if (imageUrls.length > 0) input.image_urls = imageUrls;

  const taskId = await createKieTask(opts.model, input);
  const record = await pollKieTask(taskId);

  const [url] = extractKieMediaUrls(record);
  if (url) return fetchKieMedia(url, "image/png");

  const [dataUri] = extractKieDataUris(record);
  const decoded = dataUri ? decodeDataUri(dataUri) : null;
  if (decoded) return decoded;

  throw new Error(`${opts.model} tidak mengembalikan URL atau data gambar.`);
}

/**
 * Generate one scene illustration. Combines a fixed children's-book style guide,
 * the consistent character description, the scene's visual prompt, and (when
 * available) the child's reference photo for face consistency.
 */
export async function generateSceneImage(opts: {
  imagePrompt: string;
  characterDescription: string;
  /** The page's narration text — anchors the picture to what the story says. */
  narration?: string;
  reference?: Reference;
}): Promise<SceneImage> {
  const styleGuide =
    "Children's picture-book illustration. Style: soft warm colors, gentle rounded shapes, " +
    "clean flat shading, friendly and wholesome, with clear, expressive detail on the face. " +
    "Show ONE single child as the obvious main character — centered, well-lit, and emotive. " +
    "Keep this child's appearance EXACTLY the same in every scene (same face, skin tone, " +
    `hair, and outfit): ${opts.characterDescription}. ` +
    (opts.reference
      ? "Match the child's face and features closely to the provided reference photo. "
      : "") +
    "Do NOT render any text, letters, numbers, captions, speech bubbles, watermark, or logo " +
    "anywhere in the image. Avoid extra unrelated children, duplicated characters, distorted " +
    "faces, or malformed hands.";
  // Anchor the picture to the page's actual story text so it depicts exactly
  // what is happening on this page (the narration is Indonesian; never draw it).
  const storyContext = opts.narration?.trim()
    ? `\n\nThis illustration accompanies this exact moment of the children's story ` +
      `(text is in Indonesian — depict what happens in it, but write NO text in the image): ` +
      `"${opts.narration.trim()}"`
    : "";
  const prompt = `${styleGuide}\n\nScene to illustrate: ${opts.imagePrompt}${storyContext}`;

  // Nano Banana chosen as the primary provider.
  if (providers.image.provider === "kie") {
    return generateKieImage({
      model: providers.image.model,
      prompt,
      aspectRatio: providers.image.aspectRatio,
      reference: opts.reference,
    });
  }

  if (providers.image.provider !== "gemini") {
    throw new Error(`Provider ilustrasi "${providers.image.provider}" belum didukung.`);
  }

  try {
    return await generateGoogleImage({
      model: providers.image.model,
      prompt,
      aspectRatio: providers.image.aspectRatio,
      resolution: providers.image.resolution,
      reference: opts.reference,
    });
  } catch (error) {
    // Free overflow: Gemini image quota is exhausted → try KIE Nano Banana.
    if (isImageQuotaError(error) && kieFallbackEnabled()) {
      const model = env("IMAGE_FALLBACK_MODEL", "google/nano-banana");
      try {
        return await generateKieImage({
          model,
          prompt,
          aspectRatio: providers.image.aspectRatio,
          reference: opts.reference,
        });
      } catch (fallbackError) {
        console.error("[generateSceneImage] KIE Nano Banana fallback gagal", {
          message:
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
        // Surface the original quota error so callers keep their retry/placeholder
        // behavior instead of a confusing KIE-specific message.
        throw error;
      }
    }
    throw error;
  }
}
