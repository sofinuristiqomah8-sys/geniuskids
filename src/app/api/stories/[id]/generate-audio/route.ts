import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateUserId } from "@/lib/supabase/auth";
import { synthesizeNarration } from "@/lib/ai/tts";
import { isGoogleAiRetryableError } from "@/lib/ai/google";
import {
  BUCKET_STORY_ASSETS,
  sceneAudioPath,
  openerAudioPath,
  storyAssetPublicUrl,
} from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

function audioExtension(mimeType: string): string {
  if (mimeType.includes("wav") || mimeType.includes("wave")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  return "mp3";
}

function retryResponse(error: unknown): NextResponse | null {
  if (isGoogleAiRetryableError(error)) {
    const retryAfterMs = Math.max(1_000, Math.round(error.retryAfterMs));
    return NextResponse.json(
      {
        retry: true,
        retryAfterMs,
        error: "Audio masih diproses. Sistem akan mencoba lagi sebentar lagi.",
      },
      {
        status: 202,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1_000)) },
      }
    );
  }

  const message = error instanceof Error ? error.message : "";
  if (/(429|quota|rate.?limit|resource_exhausted|too many requests|timeout)/i.test(message)) {
    const retryAfterMs = 8_000;
    return NextResponse.json(
      {
        retry: true,
        retryAfterMs,
        error: "Audio sedang antre karena limit sementara. Sistem akan mencoba lagi.",
      },
      {
        status: 202,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1_000)) },
      }
    );
  }

  return null;
}

/**
 * POST /api/stories/:id/generate-audio   body: { index?: number, kind: "scene" | "opener" }
 * Synthesizes narration audio + word timings for ONE scene (or the opener).
 * Client loops per scene to show progress. Idempotent.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    index?: number;
    kind?: "scene" | "opener";
  };
  const kind = body.kind === "opener" ? "opener" : "scene";

  const supabase = await createSupabaseServerClient();
  const userId = await getOrCreateUserId();

  const { data: story } = await supabase
    .from("stories")
    .select("id, user_id, opener_text, opener_audio_path, opener_word_timings")
    .eq("id", id)
    .maybeSingle();
  if (!story) return NextResponse.json({ error: "Cerita tidak ditemukan." }, { status: 404 });
  if (story.user_id !== userId)
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  try {
    // ---- Opener narration -------------------------------------------------
    if (kind === "opener") {
      if (story.opener_audio_path) {
        return NextResponse.json({
          kind,
          audioUrl: storyAssetPublicUrl(story.opener_audio_path),
          timings: story.opener_word_timings ?? [],
        });
      }
      if (!story.opener_text) {
        return NextResponse.json({ error: "Pembuka belum tersedia." }, { status: 400 });
      }
      const synth = await synthesizeNarration(story.opener_text);
      const path = openerAudioPath(userId, id, audioExtension(synth.mimeType));
      const { error: upErr } = await supabase.storage
        .from(BUCKET_STORY_ASSETS)
        .upload(path, synth.audio, { contentType: synth.mimeType, upsert: true });
      if (upErr) throw new Error(upErr.message);

      await supabase
        .from("stories")
        .update({ opener_audio_path: path, opener_word_timings: synth.timings })
        .eq("id", id);

      return NextResponse.json({
        kind,
        audioUrl: storyAssetPublicUrl(path),
        timings: synth.timings,
      });
    }

    // ---- Scene narration --------------------------------------------------
    const index = Number(body.index);
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "index tidak valid." }, { status: 400 });
    }

    const { data: scene } = await supabase
      .from("scenes")
      .select("id, index, narration_text, audio_path, word_timings, image_path")
      .eq("story_id", id)
      .eq("index", index)
      .maybeSingle();
    if (!scene) return NextResponse.json({ error: "Adegan tidak ditemukan." }, { status: 404 });

    if (scene.audio_path) {
      return NextResponse.json({
        index,
        audioUrl: storyAssetPublicUrl(scene.audio_path),
        timings: scene.word_timings ?? [],
      });
    }
    if (!scene.narration_text) {
      return NextResponse.json({ error: "Narasi adegan kosong." }, { status: 400 });
    }

    const synth = await synthesizeNarration(scene.narration_text);
    const path = sceneAudioPath(userId, id, index, audioExtension(synth.mimeType));
    const { error: upErr } = await supabase.storage
      .from(BUCKET_STORY_ASSETS)
      .upload(path, synth.audio, { contentType: synth.mimeType, upsert: true });
    if (upErr) throw new Error(upErr.message);

    await supabase
      .from("scenes")
      .update({
        audio_path: path,
        word_timings: synth.timings,
        status: scene.image_path ? "ready" : "audio_ready",
      })
      .eq("id", scene.id);

    return NextResponse.json({
      index,
      audioUrl: storyAssetPublicUrl(path),
      timings: synth.timings,
    });
  } catch (e) {
    const retry = retryResponse(e);
    if (retry) return retry;

    const message = e instanceof Error ? e.message : "Gagal membuat audio.";
    console.error("[generate-audio]", { storyId: id, kind, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
