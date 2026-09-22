import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storyAssetPublicUrl } from "@/lib/storage";
import { isPlaceholderPath, sceneImagePaths } from "@/lib/scene";
import Flipbook, { type FlipScene } from "@/components/story/Flipbook";

export default async function ReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: story } = await supabase
    .from("stories")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();
  if (!story) notFound();

  const { data: scenes } = await supabase
    .from("scenes")
    .select(
      "index, narration_text, image_prompt, image_prompts, image_path, image_paths, audio_path, word_timings"
    )
    .eq("story_id", id)
    .order("index", { ascending: true });

  const rows = scenes ?? [];
  // A page's images are "ready" only when every one of its 2-3 slots holds a
  // real (non-placeholder) illustration. Otherwise send the reader back to the
  // story page, which re-runs generation behind a progress UI.
  const scenePaths = rows.map((s) => sceneImagePaths(s));
  const imagesReady = scenePaths.every(
    (paths) => paths.length > 0 && paths.every((p) => p && !isPlaceholderPath(p))
  );
  if (rows.length === 0 || !imagesReady || rows.some((s) => !s.audio_path)) {
    redirect(`/story/${id}`);
  }

  const flipScenes: FlipScene[] = rows.map((s, i) => ({
    index: s.index,
    narration: s.narration_text,
    imageUrls: scenePaths[i].map((p) => (p ? storyAssetPublicUrl(p) : null)),
    audioUrl: s.audio_path ? storyAssetPublicUrl(s.audio_path) : null,
    timings: s.word_timings ?? [],
  }));

  return <Flipbook storyId={id} title={story.title} scenes={flipScenes} />;
}
