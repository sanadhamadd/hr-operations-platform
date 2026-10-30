import { authorizeApiRequest, jsonNoStore } from "@/lib/auth/session";

/** Confirms HR administrator access. HR console API routes use the same check. */
export async function GET() {
  const { viewer, response } = await authorizeApiRequest("hr");
  if (response) return response;

  return jsonNoStore({ role: viewer.membership.role });
}
