"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateUserId } from "@/lib/supabase/auth";
import { BUCKET_CHILD_PHOTOS, childPhotoPath } from "@/lib/storage";
import { findTheme, findSubTheme } from "../../../config/themes";
import { brand } from "../../../config/brand";
import type { Gender } from "@/lib/database.types";

export type CreateStoryState = {
  error: string | null;
  /** Set on success — the client navigates here (see CreateWizard). */
  storyId: string | null;
};

/**
 * Creates the child + story records from the wizard's FormData, uploads the
 * child's photo to the private bucket, then returns the new story id so the
 * CLIENT can navigate to the story page where generation kicks off.
 *
 * We deliberately do NOT redirect() from inside the action: a server-side
 * redirect makes Next re-render the destination within this same POST, so any
 * error there comes back as an opaque 500 that the error boundary can't show.
 * Navigating client-side lets /story/[id] surface its own errors normally.
 */
export async function createStory(
  _prevState: CreateStoryState,
  formData: FormData
): Promise<CreateStoryState> {
  const name = String(formData.get("name") ?? "").trim();
  const ageRaw = String(formData.get("age") ?? "").trim();
  const gender = String(formData.get("gender") ?? "male") as Gender;
  const themeId = String(formData.get("themeId") ?? "").trim();
  const subThemeId = String(formData.get("subThemeId") ?? "").trim();
  const lengthId = String(formData.get("lengthId") ?? "auto").trim();
  const situation = String(formData.get("situation") ?? "").trim();
  const photo = formData.get("photo");

  if (!name) return { error: "Nama anak wajib diisi.", storyId: null };
  if (!themeId || !subThemeId)
    return { error: "Tema dan sub tema wajib dipilih.", storyId: null };

  const age = ageRaw ? Number(ageRaw) : null;
  if (age !== null && (!Number.isFinite(age) || age < 0 || age > 17)) {
    return { error: "Usia anak harus antara 0 sampai 17 tahun.", storyId: null };
  }

  let storyId: string;

  try {
    const userId = await getOrCreateUserId();
    const supabase = await createSupabaseServerClient();

    // 1) Insert the child.
    const { data: child, error: childErr } = await supabase
      .from("children")
      .insert({ user_id: userId, name, age, gender })
      .select("id")
      .single();
    if (childErr || !child) {
      return { error: "Gagal menyimpan data anak: " + (childErr?.message ?? ""), storyId: null };
    }

    // 2) Upload the photo (if provided) to the PRIVATE child-photos bucket.
    if (photo instanceof File && photo.size > 0) {
      const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
      const path = childPhotoPath(userId, child.id, ext);
      const bytes = new Uint8Array(await photo.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from(BUCKET_CHILD_PHOTOS)
        .upload(path, bytes, { contentType: photo.type || "image/jpeg", upsert: true });
      if (!upErr) {
        await supabase.from("children").update({ photo_path: path }).eq("id", child.id);
      }
      // A failed upload is non-fatal — the story can still be generated without a
      // reference photo (illustration falls back to a described character).
    }

    // 3) Insert the story (status = pending; generation happens on the story page).
    const theme = findTheme(themeId);
    const sub = findSubTheme(themeId, subThemeId);
    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .insert({
        user_id: userId,
        child_id: child.id,
        theme_id: themeId,
        theme_label: theme?.label ?? null,
        subtheme_id: subThemeId,
        subtheme_label: sub?.label ?? null,
        situation: situation || null,
        length_id: lengthId,
        language: brand.defaultLocale,
        status: "pending",
      })
      .select("id")
      .single();
    if (storyErr || !story) {
      return { error: "Gagal membuat cerita: " + (storyErr?.message ?? ""), storyId: null };
    }
    storyId = story.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat cerita.";
    return { error: message, storyId: null };
  }

  // Success — the client (CreateWizard) navigates to the story page.
  return { error: null, storyId };
}
