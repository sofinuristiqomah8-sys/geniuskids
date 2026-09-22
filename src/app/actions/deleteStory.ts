"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Deletes a story (scenes cascade via FK). RLS ensures a user can only delete
 * their own stories. Generated storage assets are left for a later cleanup job.
 */
export async function deleteStory(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("stories").delete().eq("id", id);
  revalidatePath("/collection");
}
