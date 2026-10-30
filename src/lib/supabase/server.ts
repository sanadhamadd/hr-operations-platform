import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { authCookieOptions, getSupabaseConfig } from "./config";

/** Creates a Supabase client for the current request, authenticated by its session cookies. */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes sessions before rendering.
        }
      },
    },
  });
}
