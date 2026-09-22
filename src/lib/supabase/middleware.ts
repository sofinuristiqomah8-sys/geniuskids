import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../database.types";

/**
 * Refreshes the Supabase auth session on every request and, if there is no
 * user yet, signs the visitor in ANONYMOUSLY. This gives each device a stable
 * auth.uid() that owns its children/stories — no login screen required.
 *
 * Requires "Anonymous sign-ins" to be enabled in the Supabase dashboard:
 *   Authentication → Providers → Anonymous → Enable.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // If Supabase isn't configured yet, don't block the app (e.g. first-run dev).
  if (!url || !anonKey) return response;

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]
      ) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Create a device-scoped anonymous session.
    await supabase.auth.signInAnonymously();
  }

  return response;
}
