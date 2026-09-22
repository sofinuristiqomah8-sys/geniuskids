import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import EndingPanel, { type EndingData } from "@/components/story/EndingPanel";
import AppHeader from "@/components/ui/AppHeader";
import { t } from "@/lib/i18n";

export default async function EndingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: story } = await supabase
    .from("stories")
    .select(
      "id, title, moral_text, doa_arabic, doa_latin, doa_translation, parent_activity, parent_questions"
    )
    .eq("id", id)
    .maybeSingle();

  if (!story) notFound();

  // If the story text hasn't been generated yet, send back to generate it.
  if (!story.moral_text && !story.parent_activity) {
    redirect(`/story/${id}`);
  }

  const data: EndingData = {
    storyId: story.id,
    title: story.title,
    moral: story.moral_text,
    doa: {
      arabic: story.doa_arabic,
      latin: story.doa_latin,
      translation: story.doa_translation,
    },
    activity: story.parent_activity,
    questions: story.parent_questions ?? [],
  };

  return (
    <main className="min-h-[100dvh] bg-surface">
      <AppHeader backHref={`/story/${id}`} title={t("header.endingTitle")} />
      <EndingPanel data={data} />
    </main>
  );
}
