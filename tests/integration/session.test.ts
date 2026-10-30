import { afterAll, describe, expect, it } from "vitest";

import { disableMember, grantMembership, inviteMember } from "@/lib/auth/provisioning";

import {
  admin,
  Browser,
  createTestUser,
  deleteTestUsers,
  expectNoCredentialLeaks,
  latestEmailHtml,
  signedInBrowser,
  signIn,
  trackUser,
  uniqueEmail,
} from "./support";

afterAll(async () => {
  expectNoCredentialLeaks();
  await deleteTestUsers();
});

describe("session cookies", () => {
  it("are HttpOnly, SameSite=Lax and site-wide after sign-in", async () => {
    const browser = new Browser();
    const response = await signIn(browser, await createTestUser("employee"));
    const sessionCookies = response.setCookies.filter((cookie) => cookie.startsWith("sb-"));

    expect(sessionCookies.length).toBeGreaterThan(0);
    for (const cookie of sessionCookies) {
      expect(cookie).toMatch(/;\s*HttpOnly/i);
      expect(cookie).toMatch(/;\s*SameSite=Lax/i);
      expect(cookie).toMatch(/;\s*Path=\//i);
      expect(cookie).toMatch(/;\s*Secure/i);
    }
  });
});

describe("sign-out", () => {
  it("clears the session and ends it on the Auth server", async () => {
    const browser = await signedInBrowser(await createTestUser("employee"));
    const copiedBeforeSignOut = browser.clone();

    const response = await browser.postForm("/auth/logout", {});

    expect(response.status).toBe(303);
    expect(response.location).toBe("/login?signed_out=1");
    expect(browser.hasSession()).toBe(false);
    expect((await browser.get("/chat")).location).toBe("/login?next=%2Fchat");

    // Cookies copied before signing out still hold an unexpired access token, but the session
    // they belong to has ended, so the server no longer accepts them.
    const replayed = await copiedBeforeSignOut.get("/chat");
    expect(replayed.status).toBe(307);
    expect(replayed.location).toMatch(/^\/login/);
    expect((await copiedBeforeSignOut.get("/api/session")).status).toBe(401);
  });

  it("rejects a sign-out form submitted from another site", async () => {
    const browser = await signedInBrowser(await createTestUser("employee"));

    const response = await browser.postForm("/auth/logout", {}, "https://evil.example");

    expect(response.status).toBe(403);
    expect((await browser.get("/chat")).status).toBe(200);
  });
});

describe("session refresh and expiry", () => {
  it("refreshes an expired access token with the refresh token", async () => {
    const browser = await signedInBrowser(await createTestUser("employee"));
    const session = browser.readSession();
    browser.writeSession({ ...session, expires_at: Math.floor(Date.now() / 1000) - 60 });

    const response = await browser.get("/chat");
    const refreshed = browser.readSession();

    expect(response.status).toBe(200);
    expect(response.setCookies.some((cookie) => cookie.startsWith("sb-"))).toBe(true);
    expect(refreshed.access_token).not.toBe(session.access_token);
    expect(refreshed.refresh_token).not.toBe(session.refresh_token);
    expect(Number(refreshed.expires_at)).toBeGreaterThan(Date.now() / 1000);
  });

  it("sends the user to sign-in when an expired session cannot be refreshed", async () => {
    const browser = await signedInBrowser(await createTestUser("employee"));
    browser.writeSession({
      ...browser.readSession(),
      expires_at: Math.floor(Date.now() / 1000) - 60,
      refresh_token: "not-a-valid-refresh-token",
    });

    const page = await browser.get("/chat");

    expect(page.status).toBe(307);
    expect(page.location).toBe("/login?next=%2Fchat");
    expect((await browser.get("/api/session")).status).toBe(401);
  });

  it("treats a malformed session cookie as no session", async () => {
    const browser = new Browser();
    browser.cookies.set("sb-127-auth-token", "base64-bm90LWpzb24");

    expect((await browser.get("/chat")).location).toBe("/login?next=%2Fchat");
  });
});

describe("role and status changes", () => {
  it("removes HR access on the next request while the old session is still in use", async () => {
    const hrAdmin = await createTestUser("hr_admin");
    const browser = await signedInBrowser(hrAdmin);
    expect((await browser.get("/admin/inbox")).status).toBe(200);
    expect((await browser.get("/api/admin/access")).status).toBe(200);

    await grantMembership(admin, hrAdmin.userId, "employee");

    const page = await browser.get("/admin/inbox");
    expect(page.status).toBe(307);
    expect(page.location).toBe("/access-denied");
    expect((await browser.get("/api/admin/access")).status).toBe(403);
    expect((await browser.get("/chat")).status).toBe(200);
  });

  it("removes all access on the next request when only the membership is disabled", async () => {
    const user = await createTestUser("hr_admin");
    const browser = await signedInBrowser(user);
    expect((await browser.get("/chat")).status).toBe(200);

    // The database record alone decides: the Auth account and its session are left untouched.
    const { error } = await admin.rpc("provision_membership", {
      target_user_id: user.userId,
      new_role: "hr_admin",
      new_status: "disabled",
    });
    expect(error).toBeNull();

    expect((await browser.get("/chat")).location).toBe("/access-denied");
    expect((await browser.get("/admin/inbox")).location).toBe("/access-denied");
    expect((await browser.get("/api/session")).status).toBe(403);
    expect((await browser.get("/api/admin/access")).status).toBe(403);
    expect((await browser.get("/access-denied")).body).toContain("Your account has been disabled.");
  });

  it("ends the session and blocks sign-in when the provisioning module disables an account", async () => {
    const user = await createTestUser("hr_admin");
    const browser = await signedInBrowser(user);
    expect((await browser.get("/admin/inbox")).status).toBe(200);

    await disableMember(admin, user.userId);

    // The Auth server rejects a banned user's session, so the existing cookies no longer work.
    expect((await browser.get("/chat")).location).toBe("/login");
    expect((await browser.get("/admin/inbox")).location).toBe("/login");
    expect((await browser.get("/api/session")).status).toBe(401);

    const again = new Browser();
    expect((await signIn(again, user)).location).toBe("/login?error=disabled");
    expect(again.hasSession()).toBe(false);
  });

  it("restores access when a disabled account is granted a role again", async () => {
    const user = await createTestUser("employee");
    await disableMember(admin, user.userId);
    await grantMembership(admin, user.userId, "employee");

    const browser = await signedInBrowser(user);
    expect((await browser.get("/chat")).status).toBe(200);
  });
});

describe("invitations", () => {
  it("lets an invited user choose a password and then sign in", async () => {
    const email = uniqueEmail("invited");
    const userId = await inviteMember(admin, email, "employee");
    trackUser(userId);

    const html = await latestEmailHtml(email);
    const link = /href="([^"]+)"/.exec(html)?.[1].replaceAll("&amp;", "&");
    expect(link).toBeDefined();
    const invitation = new URL(link!);
    expect(invitation.pathname).toBe("/auth/confirm");
    expect(invitation.searchParams.get("type")).toBe("invite");

    const browser = new Browser();
    const confirmed = await browser.get(`/auth/confirm${invitation.search}`);
    expect(confirmed.status).toBe(303);
    expect(confirmed.location).toBe("/auth/set-password");
    expect(browser.hasSession()).toBe(true);

    const form = await browser.get("/auth/set-password");
    expect(form.status).toBe(200);
    expect(form.body).toContain(email);

    const password = `Invited-${crypto.randomUUID()}`;
    trackUser(userId, password);

    const tooShort = await browser.postForm("/auth/update-password", {
      password: "short",
      confirmPassword: "short",
    });
    expect(tooShort.location).toBe("/auth/set-password?error=short");

    const mismatch = await browser.postForm("/auth/update-password", {
      password,
      confirmPassword: `${password}x`,
    });
    expect(mismatch.location).toBe("/auth/set-password?error=mismatch");

    const saved = await browser.postForm("/auth/update-password", {
      password,
      confirmPassword: password,
    });
    expect(saved.status).toBe(303);
    expect(saved.location).toBe("/chat");

    const signedIn = new Browser();
    expect((await signIn(signedIn, { userId, email, password })).location).toBe("/chat");
    expect((await signedIn.get("/chat")).status).toBe(200);

    // An invitation link works only once.
    const reused = await new Browser().get(`/auth/confirm${invitation.search}`);
    expect(reused.location).toBe("/login?error=link");
  });

  it("rejects an invalid invitation link", async () => {
    const browser = new Browser();
    const response = await browser.get("/auth/confirm?token_hash=invalid&type=invite");

    expect(response.location).toBe("/login?error=link");
    expect(browser.hasSession()).toBe(false);
  });

  it("does not show the password form without a session", async () => {
    expect((await new Browser().get("/auth/set-password")).location).toBe("/login");
  });

  it("does not change a password without a session", async () => {
    const response = await new Browser().postForm("/auth/update-password", {
      password: "a-long-enough-password",
      confirmPassword: "a-long-enough-password",
    });

    expect(response.location).toBe("/login");
  });
});
