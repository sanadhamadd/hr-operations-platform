import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import {
  accessDeniedPath,
  decideAccess,
  loginPath,
  parseMembership,
  type AccessArea,
  type Membership,
  type Viewer,
} from "./access";

export type AuthorizedViewer = Viewer & { membership: Membership };

/**
 * Returns the signed-in user and their current membership, or null without a valid session.
 *
 * The user is fetched from the Auth server, which rejects sessions that have ended, and the
 * membership is read from the database on every request, so role and status changes apply to
 * the next request even while an older session token is still valid.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data, error } = await supabase.rpc("current_membership");
  if (error) {
    throw new Error("Could not load the membership for the current user.");
  }

  return { userId: user.id, email: user.email ?? "", membership: parseMembership(data) };
});

async function requireAccess(area: AccessArea): Promise<AuthorizedViewer> {
  const viewer = await getViewer();
  const decision = decideAccess(viewer, area);

  if (decision === "unauthenticated") redirect(loginPath);
  if (decision !== "allow") redirect(accessDeniedPath);

  return viewer as AuthorizedViewer;
}

/** Ends rendering with a redirect unless the user may use the employee portal. */
export function requireEmployeeAccess(): Promise<AuthorizedViewer> {
  return requireAccess("employee");
}

/** Ends rendering with a redirect unless the user is an active HR administrator. */
export function requireHrAccess(): Promise<AuthorizedViewer> {
  return requireAccess("hr");
}

const noStore = { "Cache-Control": "private, no-store" };

/** Authorizes an API request, returning either the viewer or the JSON error response to send. */
export async function authorizeApiRequest(
  area: AccessArea,
): Promise<
  { viewer: AuthorizedViewer; response?: never } | { viewer?: never; response: NextResponse }
> {
  const viewer = await getViewer();
  const decision = decideAccess(viewer, area);

  if (decision === "allow") return { viewer: viewer as AuthorizedViewer };

  const status = decision === "unauthenticated" ? 401 : 403;
  return { response: NextResponse.json({ error: decision }, { status, headers: noStore }) };
}

export function jsonNoStore(body: unknown): NextResponse {
  return NextResponse.json(body, { headers: noStore });
}
