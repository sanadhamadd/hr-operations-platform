import type { NextRequest } from "next/server";

import {
  accessDeniedPath,
  decideAccess,
  homePathFor,
  loginPath,
  minimumPasswordLength,
  parseMembership,
} from "@/lib/auth/access";
import { forbiddenRequest, seeOther } from "@/lib/auth/http";
import { isSameOriginRequest } from "@/lib/auth/request-origin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return forbiddenRequest();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return seeOther(loginPath);
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmPassword") ?? "");

  const retry = (error: string) => seeOther(`/auth/set-password?error=${error}`);

  if (password.length < minimumPasswordLength) return retry("short");
  if (password !== confirmation) return retry("mismatch");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return retry("rejected");

  const { data } = await supabase.rpc("current_membership");
  const membership = parseMembership(data);
  if (
    decideAccess({ userId: user.id, email: user.email ?? "", membership }, "employee") !==
      "allow" ||
    !membership
  ) {
    return seeOther(accessDeniedPath);
  }

  return seeOther(homePathFor(membership.role));
}
