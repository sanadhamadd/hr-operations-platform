import { authorizeApiRequest, jsonNoStore } from "@/lib/auth/session";

/** Returns the signed-in user's own role and status. */
export async function GET() {
  const { viewer, response } = await authorizeApiRequest("employee");
  if (response) return response;

  return jsonNoStore({ role: viewer.membership.role, status: viewer.membership.status });
}
