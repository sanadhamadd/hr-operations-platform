export type MemberRole = "employee" | "hr_admin";
export type MembershipStatus = "active" | "disabled";

export type Membership = {
  role: MemberRole;
  status: MembershipStatus;
};

/** The signed-in user. The membership always comes from the database, never from the request. */
export type Viewer = {
  userId: string;
  email: string;
  membership: Membership | null;
};

export type AccessArea = "employee" | "hr";

export type AccessDecision =
  "allow" | "unauthenticated" | "no-membership" | "disabled" | "forbidden";

export const loginPath = "/login";
export const accessDeniedPath = "/access-denied";

/** Matches minimum_password_length in supabase/config.toml. */
export const minimumPasswordLength = 12;

const protectedPrefixes = ["/chat", "/forms", "/requests", "/admin", "/api"];

/** Active employees and HR administrators can use the employee portal; only HR administrators can use the HR console. */
export function decideAccess(viewer: Viewer | null, area: AccessArea): AccessDecision {
  if (!viewer) return "unauthenticated";
  if (!viewer.membership) return "no-membership";
  if (viewer.membership.status !== "active") return "disabled";
  if (area === "hr" && viewer.membership.role !== "hr_admin") return "forbidden";
  return "allow";
}

/**
 * Reads the rows returned by the current_membership database function. Anything other than a
 * single row with a known role and status is treated as no membership.
 */
export function parseMembership(rows: unknown): Membership | null {
  if (!Array.isArray(rows) || rows.length !== 1) return null;

  const { role, status } = rows[0] as Record<string, unknown>;
  if (
    (role !== "employee" && role !== "hr_admin") ||
    (status !== "active" && status !== "disabled")
  ) {
    return null;
  }

  return { role, status };
}

export function homePathFor(role: MemberRole): string {
  return role === "hr_admin" ? "/admin/inbox" : "/chat";
}

/** Paths that require a session. Pages and API routes also check access themselves. */
export function isProtectedPath(pathname: string): boolean {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
