import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, inject } from "vitest";

import { createAdminClient, createMember, type ProvisionedRole } from "@/lib/auth/provisioning";

export const appUrl = inject("appUrl");
export const supabaseUrl = inject("supabaseUrl");
export const publishableKey = inject("publishableKey");
export const mailpitUrl = inject("mailpitUrl");
const secretKey = inject("secretKey");
const serverLogPath = inject("serverLogPath");

export const admin = createAdminClient({
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SECRET_KEY: secretKey,
});

const sessionCookieName = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

export type HttpResult = {
  status: number;
  location: string | null;
  body: string;
  headers: Headers;
  setCookies: string[];
};

/** Every response body the tests receive, checked for leaked credentials. */
const observedBodies: string[] = [];
const testPasswords: string[] = [];

/**
 * A minimal browser: keeps cookies between requests and does not follow redirects, so each
 * response can be checked. Requests go to the real application server.
 */
export class Browser {
  readonly cookies = new Map<string, string>();

  clone(): Browser {
    const copy = new Browser();
    for (const [name, value] of this.cookies) copy.cookies.set(name, value);
    return copy;
  }

  async request(path: string, init: RequestInit = {}): Promise<HttpResult> {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set(
        "cookie",
        [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "),
      );
    }

    const response = await fetch(new URL(path, appUrl), { ...init, headers, redirect: "manual" });
    const setCookies = response.headers.getSetCookie();
    for (const header of setCookies) this.storeCookie(header);

    const body = await response.text();
    observedBodies.push(body);

    return {
      status: response.status,
      location: localLocation(response.headers.get("location")),
      body,
      headers: response.headers,
      setCookies,
    };
  }

  get(path: string, headers: Record<string, string> = {}): Promise<HttpResult> {
    return this.request(path, { headers });
  }

  /**
   * Requests a page the way client-side navigation does, returning the React Server Components
   * payload. Next.js first redirects to add its cache-busting parameter, which is followed once.
   */
  async rsc(path: string): Promise<HttpResult> {
    const first = await this.get(path, { rsc: "1" });
    if (first.status === 307 && first.location?.includes("_rsc")) {
      return this.get(first.location, { rsc: "1" });
    }
    return first;
  }

  postForm(
    path: string,
    fields: Record<string, string>,
    origin: string | null = new URL(appUrl).origin,
  ): Promise<HttpResult> {
    const headers: Record<string, string> = {
      "content-type": "application/x-www-form-urlencoded",
    };
    if (origin) {
      headers.origin = origin;
      headers["sec-fetch-site"] = origin === new URL(appUrl).origin ? "same-origin" : "cross-site";
    }
    return this.request(path, { method: "POST", headers, body: new URLSearchParams(fields) });
  }

  hasSession(): boolean {
    return [...this.cookies.keys()].some((name) => name.startsWith(sessionCookieName));
  }

  /** Reads the Supabase session stored in the cookies. */
  readSession(): Record<string, unknown> {
    const chunks = [...this.cookies]
      .filter(([name]) => name === sessionCookieName || name.startsWith(`${sessionCookieName}.`))
      .sort(([a], [b]) => chunkIndex(a) - chunkIndex(b))
      .map(([, value]) => value)
      .join("");
    expect(chunks.startsWith("base64-")).toBe(true);
    return JSON.parse(Buffer.from(chunks.slice("base64-".length), "base64url").toString("utf8"));
  }

  /** Replaces the stored session, as a modified or forged cookie would. */
  writeSession(session: Record<string, unknown>): void {
    for (const name of [...this.cookies.keys()]) {
      if (name.startsWith(sessionCookieName)) this.cookies.delete(name);
    }
    this.cookies.set(
      sessionCookieName,
      `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
    );
  }

  private storeCookie(header: string): void {
    const [pair, ...attributes] = header.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);

    const expired = attributes.some((attribute) => {
      const [key, attributeValue = ""] = attribute.split("=");
      if (key.toLowerCase() === "max-age") return Number(attributeValue) <= 0;
      if (key.toLowerCase() === "expires") return Date.parse(attributeValue) <= Date.now();
      return false;
    });

    if (expired || value === "") this.cookies.delete(name);
    else this.cookies.set(name, value);
  }
}

function chunkIndex(name: string): number {
  const suffix = name.slice(sessionCookieName.length + 1);
  return suffix === "" ? -1 : Number(suffix);
}

/** Returns the redirect target as a path when it stays on the application, or the raw value. */
function localLocation(location: string | null): string | null {
  if (!location) return null;
  const url = new URL(location, appUrl);
  return url.origin === new URL(appUrl).origin ? `${url.pathname}${url.search}` : location;
}

export type TestUser = { userId: string; email: string; password: string };

const createdUserIds: string[] = [];

export function uniqueEmail(label: string): string {
  return `it.${label}.${randomUUID().slice(0, 8)}@example.com`;
}

export async function createTestUser(role: ProvisionedRole | null, label = role ?? "none") {
  const email = uniqueEmail(label.replace("_", "-"));
  const { userId, password } = await createMember(admin, email, role);
  createdUserIds.push(userId);
  testPasswords.push(password);
  return { userId, email, password } satisfies TestUser;
}

export function trackUser(userId: string, password?: string): void {
  createdUserIds.push(userId);
  if (password) testPasswords.push(password);
}

export async function deleteTestUsers(): Promise<void> {
  for (const userId of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(userId);
  }
}

export async function signIn(browser: Browser, user: TestUser, next?: string) {
  return browser.postForm("/auth/login", {
    email: user.email,
    password: user.password,
    ...(next === undefined ? {} : { next }),
  });
}

export async function signedInBrowser(user: TestUser): Promise<Browser> {
  const browser = new Browser();
  const response = await signIn(browser, user);
  expect(response.status).toBe(303);
  expect(browser.hasSession()).toBe(true);
  return browser;
}

/** A Supabase client with only the publishable key, as any visitor could create. */
export function publicClient(): SupabaseClient {
  return createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Waits for the newest email sent to `address` in the local mail inbox and returns its HTML. */
export async function latestEmailHtml(address: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=1`,
    );
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const message = await fetch(`${mailpitUrl}/api/v1/message/${messages[0].ID}`);
      return ((await message.json()) as { HTML: string }).HTML;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No email arrived for ${address}.`);
}

/** Checks that no response body or server log line contains a credential. */
export function expectNoCredentialLeaks(): void {
  const serverLog = readFileSync(serverLogPath, "utf8");

  for (const text of [...observedBodies, serverLog]) {
    expect(text).not.toContain(secretKey);
    expect(text).not.toContain("sb_secret_");
    for (const password of testPasswords) expect(text).not.toContain(password);
  }
  // Access and refresh tokens must not be written to the server log.
  expect(serverLog).not.toMatch(/eyJ[\w-]+\.eyJ[\w-]+/);
}
