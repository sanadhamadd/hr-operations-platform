import type { NextRequest } from "next/server";

import { decideAccess, homePathFor, loginPath, parseMembership } from "@/lib/auth/access";
import { forbiddenRequest, seeOther } from "@/lib/auth/http";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { isSameOriginRequest } from "@/lib/auth/request-origin";
import { createClient } from "@/lib/supabase/server";

function backToLogin(error: string, next: string | null) {
  const params = new URLSearchParams({ error });
  if (next) params.set("next", next);
  return seeOther(`${loginPath}?${params}`);
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return forbiddenRequest();
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeRedirectPath(form.get("next"), null);

  if (!email || !password) return backToLogin("missing", next);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    // The same message for unknown accounts and wrong passwords, so accounts cannot be discovered.
    return backToLogin(signInError.code === "user_banned" ? "disabled" : "invalid", next);
  }

  const { data, error: membershipError } = await supabase.rpc("current_membership");
  const membership = membershipError ? null : parseMembership(data);
  const decision = membershipError
    ? "unavailable"
    : decideAccess({ userId: "", email, membership }, "employee");

  if (decision !== "allow" || !membership) {
    await supabase.auth.signOut();
    return backToLogin(decision, null);
  }

  return seeOther(next ?? homePathFor(membership.role));
}
