import { NextResponse } from "next/server";

/**
 * Redirects to a path on this site after a form submission. The Location header stays relative so
 * the browser remains on the host it used; the server may know itself by a different host name.
 */
export function seeOther(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export function forbiddenRequest(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
