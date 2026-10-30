import type { NextRequest } from "next/server";

import { loginPath } from "@/lib/auth/access";
import { seeOther } from "@/lib/auth/http";
import { createClient } from "@/lib/supabase/server";

/** Verifies the token from an invitation email and starts a session for choosing a password. */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (tokenHash && type === "invite") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "invite", token_hash: tokenHash });
    if (!error) {
      return seeOther("/auth/set-password");
    }
  }

  return seeOther(`${loginPath}?error=link`);
}
