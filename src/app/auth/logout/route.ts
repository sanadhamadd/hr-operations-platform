import type { NextRequest } from "next/server";

import { loginPath } from "@/lib/auth/access";
import { forbiddenRequest, seeOther } from "@/lib/auth/http";
import { isSameOriginRequest } from "@/lib/auth/request-origin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return forbiddenRequest();
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  return seeOther(`${loginPath}?signed_out=1`);
}
