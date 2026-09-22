import { createSupabaseServerClient } from "./server";

/**
 * Returns the current user's id, creating an anonymous session if none exists.
 * Use in Server Actions / Route Handlers where you need a guaranteed owner id.
 * (Middleware also creates the anon session on navigation; this is a safety net
 * for direct API calls that skip a page load.)
 */
export async function getOrCreateUserId(): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      "Gagal membuat sesi anonim. Pastikan Anonymous sign-ins aktif di Supabase. " +
        (error?.message ?? "")
    );
  }
  return data.user.id;
}
