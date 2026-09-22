import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateUserId } from "@/lib/supabase/auth";
import { generateStoryScript, fallbackCharacterDescription } from "@/lib/ai/story";
import { analyzeChildPhoto } from "@/lib/ai/image";
import { BUCKET_CHILD_PHOTOS } from "@/lib/storage";
import { sceneImageCount } from "@/lib/scene";
import { resolveSceneCount } from "../../../../../../config/themes";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/stories/:id/generate-text
 * Generates the structured story script with Gemini and saves it:
 *   - story: title, opener, moral, doa, parent guide, status → generating_assets
 *   - scenes: one row per page (narration + image_prompt), status → pending
 * Idempotent-ish: re-running regenerates the text and replaces scenes.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const userId = await getOrCreateUserId();

  const { data: story } = await supabase
    .from("stories")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!story) return NextResponse.json({ error: "Cerita tidak ditemukan." }, { status: 404 });
  if (story.user_id !== userId)
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  // Already has text — return the saved content so a retry/refresh can resume
  // without leaving the client with empty title/opener/scenes.
  if ((story.status === "generating_assets" || story.status === "ready") && story.title) {
    const { data: existingScenes } = await supabase
      .from("scenes")
      .select("index, narration_text, image_prompts, image_prompt")
      .eq("story_id", id)
      .order("index", { ascending: true });

    return NextResponse.json({
      ok: true,
      status: story.status,
      title: story.title,
      opener: story.opener_text,
      themeLabel: story.theme_label,
      subThemeLabel: story.subtheme_label,
      scenes: (existingScenes ?? []).map((s) => ({
        index: s.index,
        narration: s.narration_text,
        imageCount: sceneImageCount(s),
      })),
    });
  }

  const { data: child } = await supabase
    .from("children")
    .select("*")
    .eq("id", story.child_id)
    .maybeSingle();
  if (!child) return NextResponse.json({ error: "Data anak tidak ditemukan." }, { status: 404 });

  await supabase.from("stories").update({ status: "generating_text" }).eq("id", id);

  try {
    // Derive a consistent character look. Prefer analyzing the uploaded photo
    // once (stored on the child for reuse); fall back to a described character.
    let characterDescription = child.character_description;
    if (!characterDescription && child.photo_path) {
      try {
        const { data: blob } = await supabase.storage
          .from(BUCKET_CHILD_PHOTOS)
          .download(child.photo_path);
        if (blob) {
          const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
          characterDescription = await analyzeChildPhoto(base64, blob.type || "image/jpeg");
          await supabase
            .from("children")
            .update({ character_description: characterDescription })
            .eq("id", child.id);
        }
      } catch {
        // Photo analysis is best-effort; continue with the fallback description.
      }
    }
    if (!characterDescription) {
      characterDescription = fallbackCharacterDescription({
        name: child.name,
        age: child.age,
        gender: child.gender,
      });
    }

    const sceneCount = resolveSceneCount(story.length_id ?? "auto", child.age ?? 5);

    const script = await generateStoryScript({
      childName: child.name,
      age: child.age,
      gender: child.gender,
      themeLabel: story.theme_label ?? story.theme_id,
      subThemeLabel: story.subtheme_label ?? story.subtheme_id,
      situation: story.situation,
      characterDescription,
      sceneCount,
    });

    // Persist story-level content.
    const { error: updErr } = await supabase
      .from("stories")
      .update({
        title: script.title,
        opener_text: script.opener,
        moral_text: script.moral,
        doa_arabic: script.doa.arabic,
        doa_latin: script.doa.latin,
        doa_translation: script.doa.translation,
        parent_activity: script.parentGuide.activity,
        parent_questions: script.parentGuide.questions,
        character_snapshot: characterDescription,
        status: "generating_assets",
        error_message: null,
      })
      .eq("id", id);
    if (updErr) throw new Error(updErr.message);

    // Replace scenes. Each page carries 2-3 sequential image prompts; the
    // singular image_prompt mirrors the first for backward compatibility.
    await supabase.from("scenes").delete().eq("story_id", id);
    const rows = script.scenes.map((s, i) => ({
      story_id: id,
      index: i,
      narration_text: s.narration,
      image_prompt: s.imagePrompts[0] ?? "",
      image_prompts: s.imagePrompts,
      image_paths: [],
      status: "pending" as const,
    }));
    const { error: sceneErr } = await supabase.from("scenes").insert(rows);
    if (sceneErr) throw new Error(sceneErr.message);

    return NextResponse.json({
      ok: true,
      status: "generating_assets",
      title: script.title,
      opener: script.opener,
      themeLabel: story.theme_label,
      subThemeLabel: story.subtheme_label,
      scenes: script.scenes.map((s, i) => ({
        index: i,
        narration: s.narration,
        imageCount: s.imagePrompts.length,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal membuat cerita.";
    console.error("[generate-text]", { storyId: id, message });
    await supabase
      .from("stories")
      .update({ status: "error", error_message: message })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
