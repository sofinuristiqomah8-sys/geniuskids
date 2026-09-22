import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateUserId } from "@/lib/supabase/auth";
import { generateSceneImage } from "@/lib/ai/image";
import { isGoogleAiRetryableError } from "@/lib/ai/google";
import {
  BUCKET_CHILD_PHOTOS,
  BUCKET_STORY_ASSETS,
  sceneImagePath,
  storyAssetPublicUrl,
} from "@/lib/storage";
import { fallbackCharacterDescription } from "@/lib/ai/story";
import { isPlaceholderPath, sceneImagePaths, sceneImagePrompts } from "@/lib/scene";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImageAsset = {
  data: Uint8Array;
  mimeType: string;
};

function imageExtension(mimeType: string): string {
  if (mimeType.includes("svg")) return "svg";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

function isQuotaError(message: string): boolean {
  return /(429|quota|rate.?limit|resource_exhausted|too many requests)/i.test(message);
}

/** Fallback wait the client honours when all image keys are on cooldown. */
const IMAGE_RETRY_AFTER_MS = 9_000;

function fallbackSceneImage(index: number): ImageAsset {
  const palettes = [
    { sky: "#fde68a", glow: "#f97316", ground: "#34d399", accent: "#7c3aed" },
    { sky: "#bfdbfe", glow: "#facc15", ground: "#86efac", accent: "#ef4444" },
    { sky: "#fecdd3", glow: "#fb7185", ground: "#a7f3d0", accent: "#2563eb" },
    { sky: "#ddd6fe", glow: "#f59e0b", ground: "#bbf7d0", accent: "#059669" },
  ];
  const p = palettes[index % palettes.length];
  const cloudOffset = 70 + ((index * 47) % 160);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${p.sky}"/>
<stop offset="1" stop-color="#fff7ed"/>
</linearGradient>
<radialGradient id="sun" cx="50%" cy="50%" r="50%">
<stop offset="0" stop-color="#fff7ad"/>
<stop offset="1" stop-color="${p.glow}"/>
</radialGradient>
</defs>
<rect width="1200" height="900" fill="url(#sky)"/>
<circle cx="930" cy="150" r="95" fill="url(#sun)" opacity=".92"/>
<g opacity=".82" fill="#ffffff">
<ellipse cx="${210 + cloudOffset}" cy="170" rx="105" ry="45"/>
<ellipse cx="${290 + cloudOffset}" cy="155" rx="75" ry="52"/>
<ellipse cx="${365 + cloudOffset}" cy="178" rx="90" ry="40"/>
</g>
<path d="M0 610 C190 520 350 650 520 560 C725 450 880 600 1200 500 L1200 900 L0 900 Z" fill="${p.ground}"/>
<path d="M0 695 C210 635 395 760 590 690 C790 615 965 715 1200 650 L1200 900 L0 900 Z" fill="#16a34a" opacity=".45"/>
<g transform="translate(490 382)">
<circle cx="110" cy="100" r="72" fill="#f8d7b4"/>
<path d="M38 95 C50 20 175 18 184 98 C150 70 85 70 38 95Z" fill="#3f2a1d"/>
<rect x="54" y="168" width="118" height="190" rx="54" fill="${p.accent}"/>
<circle cx="88" cy="105" r="9" fill="#2f241f"/>
<circle cx="132" cy="105" r="9" fill="#2f241f"/>
<path d="M84 137 C105 156 130 156 149 137" fill="none" stroke="#7c2d12" stroke-width="8" stroke-linecap="round"/>
<path d="M58 226 C5 255 -20 310 -18 360" fill="none" stroke="#f8d7b4" stroke-width="32" stroke-linecap="round"/>
<path d="M168 226 C222 255 248 310 245 360" fill="none" stroke="#f8d7b4" stroke-width="32" stroke-linecap="round"/>
</g>
<g fill="#ffffff" opacity=".35">
<circle cx="140" cy="760" r="22"/>
<circle cx="1010" cy="680" r="18"/>
<circle cx="1080" cy="740" r="12"/>
</g>
</svg>`;

  return {
    data: new TextEncoder().encode(svg),
    mimeType: "image/svg+xml",
  };
}

/**
 * POST /api/stories/:id/generate-asset
 *   body: { index: number, imageIndex?: number, allowFallback?: boolean }
 * Generates ONE illustration for a scene page. A page holds 2-3 sequential
 * ("berkesinambungan") images, so the client loops over (index, imageIndex) to
 * show progress and stay under serverless time limits. Idempotent per sub-image.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    index?: number;
    imageIndex?: number;
    // Client sets this on its LAST retry so a real quota outage still yields a
    // (regenerable) placeholder instead of an infinitely pending scene.
    allowFallback?: boolean;
  };
  const index = Number(body.index);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "index tidak valid." }, { status: 400 });
  }
  const imageIndex = Number.isInteger(body.imageIndex) ? Number(body.imageIndex) : 0;
  if (imageIndex < 0) {
    return NextResponse.json({ error: "imageIndex tidak valid." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const userId = await getOrCreateUserId();

  const { data: story } = await supabase
    .from("stories")
    .select("id, user_id, child_id, character_snapshot")
    .eq("id", id)
    .maybeSingle();
  if (!story) return NextResponse.json({ error: "Cerita tidak ditemukan." }, { status: 404 });
  if (story.user_id !== userId)
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { data: scene } = await supabase
    .from("scenes")
    .select("id, index, narration_text, image_prompt, image_prompts, image_path, image_paths")
    .eq("story_id", id)
    .eq("index", index)
    .maybeSingle();
  if (!scene) return NextResponse.json({ error: "Adegan tidak ditemukan." }, { status: 404 });

  const prompts = sceneImagePrompts(scene);
  if (imageIndex >= prompts.length) {
    return NextResponse.json({ error: "imageIndex di luar jangkauan." }, { status: 400 });
  }
  const paths = sceneImagePaths(scene);
  const existing = paths[imageIndex];

  // Already generated with a REAL illustration → return existing. Placeholder
  // SVGs (saved during a past quota outage) fall through so they get retried
  // and replaced with real art once quota recovers.
  if (existing && !isPlaceholderPath(existing)) {
    return NextResponse.json({
      index,
      imageIndex,
      imageUrl: storyAssetPublicUrl(existing),
    });
  }

  try {
    const { data: child } = await supabase
      .from("children")
      .select("name, age, gender, photo_path")
      .eq("id", story.child_id)
      .maybeSingle();

    const characterDescription =
      story.character_snapshot ??
      (child
        ? fallbackCharacterDescription({ name: child.name, age: child.age, gender: child.gender })
        : "seorang anak yang ceria");

    // Reference photo for face consistency (best-effort). The provider wrapper
    // can consume this short-lived signed URL or inline it server-side.
    let reference: { url: string } | undefined;
    if (child?.photo_path) {
      const { data: signed } = await supabase.storage
        .from(BUCKET_CHILD_PHOTOS)
        .createSignedUrl(child.photo_path, 60 * 15);
      if (signed?.signedUrl) {
        reference = { url: signed.signedUrl };
      }
    }

    // Keep the whole sequence coherent: tell the model which step this is.
    const stepPrompt =
      prompts.length > 1
        ? `${prompts[imageIndex]} (Part ${imageIndex + 1} of ${prompts.length} in a ` +
          `continuous sequence — same setting, same character, consistent art style.)`
        : prompts[imageIndex];

    let image: ImageAsset;
    let fallback = false;
    try {
      image = await generateSceneImage({
        imagePrompt: stepPrompt,
        characterDescription,
        narration: scene.narration_text ?? undefined,
        reference,
      });
    } catch (imageError) {
      const message =
        imageError instanceof Error ? imageError.message : "Gagal membuat ilustrasi.";
      console.error("[generate-asset:image]", { storyId: id, index, imageIndex, message });
      if (!isQuotaError(message)) throw imageError;

      // Quota/rate-limit outage. Unless the client has exhausted its retries and
      // explicitly accepts a placeholder, ask it to wait and try again — that way
      // scenes get REAL art whenever quota recovers, instead of a locked-in
      // generic figure. Nothing is persisted on the retry path.
      if (!body.allowFallback) {
        const retryAfterMs = isGoogleAiRetryableError(imageError)
          ? imageError.retryAfterMs
          : IMAGE_RETRY_AFTER_MS;
        return NextResponse.json(
          { index, imageIndex, retry: true, retryAfterMs },
          { status: 202 }
        );
      }

      image = fallbackSceneImage(index + imageIndex);
      fallback = true;
    }

    const ext = imageExtension(image.mimeType);
    const path = sceneImagePath(userId, id, index, ext, imageIndex);
    const { error: upErr } = await supabase.storage
      .from(BUCKET_STORY_ASSETS)
      .upload(path, image.data, { contentType: image.mimeType, upsert: true });
    if (upErr) throw new Error(upErr.message);

    // Merge this image into the ordered paths array (read-modify-write; the
    // client generates a scene's images sequentially so there's no race).
    const nextPaths = Array.from({ length: prompts.length }, (_, i) =>
      i === imageIndex ? path : paths[i] ?? null
    );
    const allReady = nextPaths.every((p) => p && !isPlaceholderPath(p));
    await supabase
      .from("scenes")
      .update({
        image_paths: nextPaths,
        image_path: nextPaths[0] ?? path, // singular mirrors the first image
        status: allReady ? "image_ready" : "pending",
      })
      .eq("id", scene.id);

    return NextResponse.json({
      index,
      imageIndex,
      imageUrl: storyAssetPublicUrl(path),
      fallback,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal membuat ilustrasi.";
    console.error("[generate-asset]", { storyId: id, index, imageIndex, message });
    await supabase.from("scenes").update({ status: "error" }).eq("id", scene.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
