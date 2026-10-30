/**
 * Account provisioning for the local environment. This is the only module that uses the Supabase
 * secret key. The application never imports it; it is run from the command line:
 *
 *   npm run auth:provision -- invite <email> <employee|hr_admin>
 *   npm run auth:provision -- create <email> <employee|hr_admin>
 *   npm run auth:provision -- grant <email> <employee|hr_admin>
 *   npm run auth:provision -- disable <email>
 *
 * Only synthetic example.com addresses are accepted.
 */
import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ProvisionedRole = "employee" | "hr_admin";

const roles: readonly string[] = ["employee", "hr_admin"];
// Long enough that a disabled account cannot sign in again until it is re-enabled.
const disabledBanDuration = "876000h";

export function createAdminClient(
  env: Record<string, string | undefined> = process.env,
): SupabaseClient {
  const url = env.SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function assertSyntheticEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[a-z0-9._+-]+@example\.com$/.test(normalized)) {
    throw new Error("Only synthetic example.com email addresses can be provisioned.");
  }
  return normalized;
}

export function assertRole(role: string): ProvisionedRole {
  if (!roles.includes(role)) {
    throw new Error(`Role must be one of: ${roles.join(", ")}.`);
  }
  return role as ProvisionedRole;
}

async function setMembership(
  admin: SupabaseClient,
  userId: string,
  role: ProvisionedRole,
  status: "active" | "disabled",
): Promise<void> {
  const { error } = await admin.rpc("provision_membership", {
    target_user_id: userId,
    new_role: role,
    new_status: status,
  });
  if (error) throw new Error(`Could not update the membership: ${error.message}`);
}

export async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string> {
  const normalized = assertSyntheticEmail(email);

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list users: ${error.message}`);

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalized);
    if (user) return user.id;
    if (data.users.length < 1000) break;
  }

  throw new Error("No account exists for that email address.");
}

/** Creates the account and sends an invitation email, through which the user chooses a password. */
export async function inviteMember(
  admin: SupabaseClient,
  email: string,
  role: ProvisionedRole,
): Promise<string> {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(assertSyntheticEmail(email));
  if (error) throw new Error(`Could not invite the user: ${error.message}`);

  await setMembership(admin, data.user.id, role, "active");
  return data.user.id;
}

/** Creates a confirmed account with a generated password, for local demonstrations and tests. */
export async function createMember(
  admin: SupabaseClient,
  email: string,
  role: ProvisionedRole | null,
  password: string = randomBytes(18).toString("base64url"),
): Promise<{ userId: string; password: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email: assertSyntheticEmail(email),
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Could not create the user: ${error.message}`);

  if (role) await setMembership(admin, data.user.id, role, "active");
  return { userId: data.user.id, password };
}

/** Sets an active membership with the given role and lifts any sign-in ban. */
export async function grantMembership(
  admin: SupabaseClient,
  userId: string,
  role: ProvisionedRole,
): Promise<void> {
  await setMembership(admin, userId, role, "active");

  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) throw new Error(`Could not lift the sign-in ban: ${error.message}`);
}

/**
 * Disables the membership, which removes access on the user's next request, and bans the account
 * so it can neither sign in nor refresh its session.
 */
export async function disableMember(admin: SupabaseClient, userId: string): Promise<void> {
  await setMembership(admin, userId, "employee", "disabled");

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: disabledBanDuration,
  });
  if (error) throw new Error(`Could not ban the account: ${error.message}`);
}

async function main(args: string[]): Promise<void> {
  const [command, email, role] = args;
  const admin = createAdminClient();

  switch (command) {
    case "invite":
      await inviteMember(admin, email ?? "", assertRole(role ?? ""));
      console.log(`Invited ${email} as ${role}. The invitation is in the local email inbox.`);
      return;
    case "create": {
      const { password } = await createMember(admin, email ?? "", assertRole(role ?? ""));
      console.log(`Created ${email} as ${role}. Local password: ${password}`);
      return;
    }
    case "grant":
      await grantMembership(
        admin,
        await findUserIdByEmail(admin, email ?? ""),
        assertRole(role ?? ""),
      );
      console.log(`${email} is now an active ${role}.`);
      return;
    case "disable":
      await disableMember(admin, await findUserIdByEmail(admin, email ?? ""));
      console.log(`${email} is disabled.`);
      return;
    default:
      throw new Error("Usage: invite|create|grant <email> <employee|hr_admin>, or disable <email>");
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
