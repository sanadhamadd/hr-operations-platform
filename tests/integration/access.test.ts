import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createMember } from "@/lib/auth/provisioning";

import {
  admin,
  Browser,
  createTestUser,
  deleteTestUsers,
  expectNoCredentialLeaks,
  publicClient,
  publishableKey,
  signedInBrowser,
  signIn,
  supabaseUrl,
  trackUser,
  uniqueEmail,
  type TestUser,
} from "./support";

const employeePages = ["/chat", "/forms", "/requests"];
const adminPages = ["/admin/inbox", "/admin/people", "/admin/questions", "/admin/analytics"];

let employee: TestUser;
let hrAdmin: TestUser;
let employeeBrowser: Browser;
let hrBrowser: Browser;

beforeAll(async () => {
  employee = await createTestUser("employee");
  hrAdmin = await createTestUser("hr_admin");
  employeeBrowser = await signedInBrowser(employee);
  hrBrowser = await signedInBrowser(hrAdmin);
});

afterAll(async () => {
  expectNoCredentialLeaks();
  await deleteTestUsers();
});

describe("visitors without a session", () => {
  const visitor = new Browser();

  it.each([...employeePages, "/admin", ...adminPages])("%s redirects to sign-in", async (path) => {
    const response = await visitor.get(path);

    expect(response.status).toBe(307);
    expect(response.location).toBe(`/login?next=${encodeURIComponent(path)}`);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("cannot fetch protected page data through a React Server Components request", async () => {
    const response = await visitor.rsc("/admin/people");

    expect(response.status).toBe(307);
    expect(response.location).toMatch(/^\/login\?next=/);
    expect(response.body).not.toContain("Planned for this page");
  });

  it.each(["/api/session", "/api/admin/access"])("gets 401 from %s", async (path) => {
    const response = await visitor.get(path);

    expect(response.status).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ error: "unauthenticated" });
  });

  it("cannot read memberships through the database API", async () => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/current_membership`, {
      method: "POST",
      headers: { apikey: publishableKey, "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(401);
  });

  it("can open the public landing and sign-in pages", async () => {
    expect((await visitor.get("/")).status).toBe(200);
    expect((await visitor.get("/login")).status).toBe(200);
  });
});

describe("an active employee", () => {
  it.each(employeePages)("can open %s", async (path) => {
    const response = await employeeBrowser.get(path);

    expect(response.status).toBe(200);
    expect(response.body).toContain(employee.email);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it.each(["/admin", ...adminPages])("is sent to the access-denied page from %s", async (path) => {
    const response = await employeeBrowser.get(path);

    expect(response.status).toBe(307);
    expect(response.location).toBe("/access-denied");
    expect(response.body).not.toContain("Planned for this page");
  });

  it("cannot fetch HR page data through a React Server Components request", async () => {
    const response = await employeeBrowser.rsc("/admin/people");

    expect(response.body).not.toContain("Planned for this page");
    expect(response.body).not.toContain("Manage who can use the platform");
  });

  it("gets 403 from the HR-only API", async () => {
    const response = await employeeBrowser.get("/api/admin/access");

    expect(response.status).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: "forbidden" });
  });

  it("gets only their own role and status from the session API", async () => {
    const response = await employeeBrowser.get("/api/session");

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ role: "employee", status: "active" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("sees an explanation on the access-denied page", async () => {
    const response = await employeeBrowser.get("/access-denied");

    expect(response.status).toBe(200);
    expect(response.body).toContain("Your account does not have access to that page.");
  });
});

describe("an active HR administrator", () => {
  it.each(adminPages)("can open %s", async (path) => {
    const response = await hrBrowser.get(path);

    expect(response.status).toBe(200);
    expect(response.body).toContain(hrAdmin.email);
  });

  it("is redirected from /admin to the HR Inbox", async () => {
    const response = await hrBrowser.get("/admin");

    expect(response.status).toBe(307);
    expect(response.location).toBe("/admin/inbox");
  });

  it("can open the employee portal", async () => {
    expect((await hrBrowser.get("/chat")).status).toBe(200);
  });

  it("receives HR page data through a React Server Components request", async () => {
    const response = await hrBrowser.rsc("/admin/people");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/x-component");
    expect(response.body).toContain("Planned for this page");
  });

  it("can use the HR-only API", async () => {
    const response = await hrBrowser.get("/api/admin/access");

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ role: "hr_admin" });
  });
});

describe("sign-in outcomes", () => {
  it("lands each role in its own portal", async () => {
    expect((await signIn(new Browser(), employee)).location).toBe("/chat");
    expect((await signIn(new Browser(), hrAdmin)).location).toBe("/admin/inbox");
  });

  it("gives the same answer for a wrong password and an unknown account", async () => {
    const wrongPassword = new Browser();
    const unknown = new Browser();

    const first = await signIn(wrongPassword, { ...employee, password: "not-the-password-1" });
    const second = await signIn(unknown, {
      userId: "",
      email: uniqueEmail("unknown"),
      password: "not-the-password-1",
    });

    expect(first.location).toBe("/login?error=invalid");
    expect(second.location).toBe("/login?error=invalid");
    expect(wrongPassword.hasSession()).toBe(false);
    expect(unknown.hasSession()).toBe(false);
  });

  it("refuses an account without a membership and leaves no session", async () => {
    const browser = new Browser();
    const response = await signIn(browser, await createTestUser(null));

    expect(response.location).toBe("/login?error=no-membership");
    expect(browser.hasSession()).toBe(false);
  });

  it("refuses an account whose membership is disabled", async () => {
    const user = await createTestUser("employee", "disabled");
    const { error } = await admin.rpc("provision_membership", {
      target_user_id: user.userId,
      new_role: "employee",
      new_status: "disabled",
    });
    expect(error).toBeNull();

    const browser = new Browser();
    const response = await signIn(browser, user);

    expect(response.location).toBe("/login?error=disabled");
    expect(browser.hasSession()).toBe(false);
  });

  it("rejects a sign-in form submitted from another site", async () => {
    const browser = new Browser();
    const response = await browser.postForm(
      "/auth/login",
      { email: employee.email, password: employee.password },
      "https://evil.example",
    );

    expect(response.status).toBe(403);
    expect(browser.hasSession()).toBe(false);
  });

  it("rejects a sign-in form without an Origin header", async () => {
    const browser = new Browser();
    const response = await browser.postForm(
      "/auth/login",
      { email: employee.email, password: employee.password },
      null,
    );

    expect(response.status).toBe(403);
    expect(browser.hasSession()).toBe(false);
  });
});

describe("redirect targets", () => {
  it("returns to a requested page on this site after sign-in", async () => {
    expect((await signIn(new Browser(), employee, "/forms")).location).toBe("/forms");
  });

  it.each(["https://evil.example/chat", "//evil.example", "/\\evil.example"])(
    "ignores the external target %s",
    async (next) => {
      const response = await signIn(new Browser(), employee, next);

      expect(response.status).toBe(303);
      expect(response.location).toBe("/chat");
    },
  );

  it("does not carry an external target into the sign-in form", async () => {
    const response = await new Browser().get(
      `/login?next=${encodeURIComponent("https://evil.example")}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).not.toMatch(/<input[^>]*name="next"/);
    expect(response.body).not.toContain('value="https://evil.example"');
  });
});

describe("forged role information", () => {
  it("ignores role cookies and headers sent by the browser", async () => {
    const forged = employeeBrowser.clone();
    forged.cookies.set("role", "hr_admin");
    forged.cookies.set("user_role", "hr_admin");

    const page = await forged.get("/admin/inbox", { "x-user-role": "hr_admin" });
    const api = await forged.get("/api/admin/access", { "x-user-role": "hr_admin" });

    expect(page.location).toBe("/access-denied");
    expect(api.status).toBe(403);
  });

  it("rejects a session cookie whose token was altered to claim another user and role", async () => {
    const forged = employeeBrowser.clone();
    const session = forged.readSession();
    const [header, payload, signature] = String(session.access_token).split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const alteredToken = [
      header,
      Buffer.from(
        JSON.stringify({
          ...claims,
          sub: hrAdmin.userId,
          email: hrAdmin.email,
          user_metadata: { role: "hr_admin" },
          app_metadata: { role: "hr_admin" },
        }),
      ).toString("base64url"),
      signature,
    ].join(".");
    forged.writeSession({ ...session, access_token: alteredToken, refresh_token: "forged" });

    const page = await forged.get("/admin/inbox");
    const api = await forged.get("/api/admin/access");
    const database = await fetch(`${supabaseUrl}/rest/v1/rpc/current_membership`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        authorization: `Bearer ${alteredToken}`,
        "content-type": "application/json",
      },
      body: "{}",
    });

    expect(page.status).toBe(307);
    expect(page.location).toMatch(/^\/login/);
    expect(api.status).toBe(401);
    expect(database.status).toBe(401);
  });

  it("ignores a role the user writes into their own profile metadata", async () => {
    const user = await createTestUser("employee", "metadata");
    const client = publicClient();
    const { error: signInError } = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    expect(signInError).toBeNull();
    const { data, error } = await client.auth.updateUser({ data: { role: "hr_admin" } });
    expect(error).toBeNull();
    expect(data.user?.user_metadata.role).toBe("hr_admin");

    const browser = await signedInBrowser(user);

    expect((await browser.get("/admin/inbox")).location).toBe("/access-denied");
    expect((await browser.get("/api/admin/access")).status).toBe(403);
    expect(JSON.parse((await browser.get("/api/session")).body)).toEqual({
      role: "employee",
      status: "active",
    });
  });

  it("cannot be granted a role by a signed-in user through the database API", async () => {
    const session = employeeBrowser.readSession();
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/provision_membership`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        authorization: `Bearer ${String(session.access_token)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        target_user_id: employee.userId,
        new_role: "hr_admin",
        new_status: "active",
      }),
    });

    expect([401, 403, 404]).toContain(response.status);
    expect((await employeeBrowser.get("/api/admin/access")).status).toBe(403);
  });
});

describe("provisioning", () => {
  it("accepts only synthetic example.com addresses", async () => {
    await expect(createMember(admin, "someone@larkspur.test", "employee")).rejects.toThrow(
      "example.com",
    );
  });

  it("creates accounts whose membership the database reports", async () => {
    const { userId, password } = await createMember(admin, uniqueEmail("provisioned"), "hr_admin");
    trackUser(userId, password);

    const { data } = await admin.auth.admin.getUserById(userId);
    expect(data.user?.email_confirmed_at).toBeTruthy();
  });
});
