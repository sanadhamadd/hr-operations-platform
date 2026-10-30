import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { admin, Browser, publicClient, publishableKey, supabaseUrl, uniqueEmail } from "./support";

async function accountExists(email: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  expect(error).toBeNull();
  return data.users.some((user) => user.email === email);
}

describe("the Auth service", () => {
  it("refuses public email and password sign-up", async () => {
    const email = uniqueEmail("signup");
    const { data, error } = await publicClient().auth.signUp({
      email,
      password: "a-long-enough-password-1",
    });

    expect(error?.code).toBe("signup_disabled");
    expect(data.user).toBeNull();
    expect(await accountExists(email)).toBe(false);
  });

  it("refuses sign-up requests sent directly to the Auth API", async () => {
    const email = uniqueEmail("signup-direct");
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: publishableKey, "content-type": "application/json" },
      body: JSON.stringify({ email, password: "a-long-enough-password-1" }),
    });

    expect(response.status).toBe(422);
    expect(((await response.json()) as { error_code: string }).error_code).toBe("signup_disabled");
    expect(await accountExists(email)).toBe(false);
  });

  it("refuses anonymous sign-in", async () => {
    const { data, error } = await publicClient().auth.signInAnonymously();

    expect(error?.code).toBe("anonymous_provider_disabled");
    expect(data.session).toBeNull();
  });

  it("does not create accounts through one-time sign-in codes", async () => {
    const email = uniqueEmail("otp");
    const { error } = await publicClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    expect(error?.code).toBe("signup_disabled");
    expect(await accountExists(email)).toBe(false);
  });
});

describe("the application", () => {
  it.each(["/signup", "/register", "/auth/signup"])("has no sign-up page at %s", async (path) => {
    expect((await new Browser().get(path)).status).toBe(404);
  });
});

describe("browser bundles", () => {
  const staticRoot = join(process.cwd(), ".next", "static");

  function bundleText(): string {
    const files = readdirSync(staticRoot, { recursive: true, withFileTypes: true }).filter(
      (entry) => entry.isFile() && /\.(js|css|html|json)$/.test(entry.name),
    );
    expect(files.length).toBeGreaterThan(0);
    return files
      .map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"))
      .join("\n");
  }

  it("contain no Supabase keys, key names or provisioning code", () => {
    const text = bundleText();

    expect(text).not.toContain("SUPABASE_SECRET_KEY");
    expect(text).not.toContain("sb_secret_");
    expect(text).not.toContain("provision_membership");
    expect(text).not.toContain(publishableKey);
    expect(text).not.toContain("SUPABASE_PUBLISHABLE_KEY");
  });
});
