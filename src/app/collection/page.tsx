import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storyAssetPublicUrl } from "@/lib/storage";
import { t } from "@/lib/i18n";
import CollectionGrid, { type CollectionItem } from "@/components/collection/CollectionGrid";
import AppHeader from "@/components/ui/AppHeader";

export const dynamic = "force-dynamic";

/** Compact "new story" action shown in the header. */
function NewStoryAction() {
  return (
    <Link
      href="/create"
      aria-label={t("collection.createFirst")}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-xl leading-none text-white shadow-sm transition active:scale-90"
    >
      +
    </Link>
  );
}

export default async function CollectionPage() {
  const supabase = await createSupabaseServerClient();

  const { data: stories } = await supabase
    .from("stories")
    .select("id, title, status, theme_label, subtheme_label, error_message, child_id, created_at")
    .order("created_at", { ascending: false });

  const list = stories ?? [];

  if (list.length === 0) {
    return (
      <main className="flex min-h-[100dvh] flex-col bg-surface">
        <AppHeader backHref="/" title={t("collection.title")} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="float text-6xl">📚</div>
          <p className="anim-fade-up max-w-xs text-sm text-ink-soft">{t("collection.empty")}</p>
          <Link href="/create" className="btn-primary anim-fade-up d1 pulse-glow mt-2">
            ✨ {t("collection.createFirst")}
          </Link>
        </div>
      </main>
    );
  }

  const childIds = [...new Set(list.map((s) => s.child_id))];
  const storyIds = list.map((s) => s.id);

  const [{ data: children }, { data: covers }, { data: sceneRows }] = await Promise.all([
    childIds.length
      ? supabase.from("children").select("id, name").in("id", childIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    storyIds.length
      ? supabase
          .from("scenes")
          .select("story_id, image_path")
          .eq("index", 0)
          .in("story_id", storyIds)
      : Promise.resolve({ data: [] as { story_id: string; image_path: string | null }[] }),
    storyIds.length
      ? supabase.from("scenes").select("story_id, image_path, audio_path").in("story_id", storyIds)
      : Promise.resolve({
          data: [] as { story_id: string; image_path: string | null; audio_path: string | null }[],
        }),
  ]);

  const nameById = new Map((children ?? []).map((c) => [c.id, c.name]));
  const coverById = new Map((covers ?? []).map((c) => [c.story_id, c.image_path]));
  const sceneStatsById = new Map<string, { count: number; images: number; audio: number }>();
  for (const r of sceneRows ?? []) {
    const stats = sceneStatsById.get(r.story_id) ?? { count: 0, images: 0, audio: 0 };
    stats.count += 1;
    if (r.image_path) stats.images += 1;
    if (r.audio_path) stats.audio += 1;
    sceneStatsById.set(r.story_id, stats);
  }

  const items: CollectionItem[] = list.map((s) => {
    const cover = coverById.get(s.id);
    const stats = sceneStatsById.get(s.id) ?? { count: 0, images: 0, audio: 0 };
    const assetSlots = stats.count * 2;
    const progress =
      s.status === "ready"
        ? 100
        : s.status === "error"
          ? null
          : assetSlots > 0
            ? Math.max(12, Math.round(((stats.images + stats.audio) / assetSlots) * 100))
            : s.status === "generating_text"
              ? 20
              : 8;

    return {
      id: s.id,
      title: s.title,
      status: s.status,
      themeLabel: s.theme_label,
      subthemeLabel: s.subtheme_label,
      errorMessage: s.error_message,
      childName: nameById.get(s.child_id) ?? null,
      coverUrl: cover ? storyAssetPublicUrl(cover) : null,
      createdAt: s.created_at,
      sceneCount: stats.count,
      imageCount: stats.images,
      audioCount: stats.audio,
      progress,
    };
  });

  const childrenCount = childIds.length;

  return (
    <main className="min-h-[100dvh] bg-surface">
      <AppHeader backHref="/" title={t("collection.title")} right={<NewStoryAction />} />

      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <div className="anim-fade-up mb-5">
          <h1 className="text-2xl font-extrabold text-ink">📚 {t("collection.title")}</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {t("collection.subtitle")} ·{" "}
            <span className="font-semibold text-brand-primary">
              {t("collection.stats", { stories: items.length, children: childrenCount })}
            </span>
          </p>
        </div>

        <CollectionGrid items={items} />
      </div>
    </main>
  );
}
