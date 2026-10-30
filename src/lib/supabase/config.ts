import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Connection settings for the application's Supabase clients. Both values are read on the server
 * at request time; neither is exposed to the browser. The secret key is deliberately not read
 * here: only the provisioning module uses it.
 */
export function getSupabaseConfig(): { url: string; publishableKey: string } {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set.");
  }

  return { url, publishableKey };
}

/** Session cookies are only ever read on the server, so browser scripts cannot access them. */
export const authCookieOptions: CookieOptionsWithName = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};
