import { NextResponse, type NextRequest } from "next/server";

import { isProtectedPath, loginPath } from "@/lib/auth/access";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Refreshes the session on every request and sends visitors without a session away from protected
 * paths. This is not the authorization check: pages and API routes verify the user and their
 * membership themselves.
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPath(pathname)) return response;

  response.headers.set("Cache-Control", "private, no-store");
  if (userId) return response;

  const denied = pathname.startsWith("/api/")
    ? NextResponse.json({ error: "unauthenticated" }, { status: 401 })
    : NextResponse.redirect(
        new URL(
          `${loginPath}?${new URLSearchParams({ next: `${pathname}${search}` })}`,
          request.url,
        ),
      );

  // Keep any cookie changes, such as clearing an invalid session.
  for (const cookie of response.cookies.getAll()) {
    denied.cookies.set(cookie);
  }
  denied.headers.set("Cache-Control", "private, no-store");
  return denied;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
