import { describe, expect, it } from "vitest";

import { assertRole, assertSyntheticEmail, createAdminClient } from "./provisioning";

describe("provisioning input checks", () => {
  it("accepts and normalizes synthetic example.com addresses", () => {
    expect(assertSyntheticEmail(" Jordan.Lee@Example.com ")).toBe("jordan.lee@example.com");
  });

  it.each([
    "person@larkspur.test",
    "person@example.com.evil",
    "person@sub.example.com",
    "not-an-email",
    "",
  ])("rejects %j", (email) => {
    expect(() => assertSyntheticEmail(email)).toThrow("example.com");
  });

  it("accepts only the two membership roles", () => {
    expect(assertRole("employee")).toBe("employee");
    expect(assertRole("hr_admin")).toBe("hr_admin");
    expect(() => assertRole("admin")).toThrow();
    expect(() => assertRole("")).toThrow();
  });

  it("requires the secret key to create an admin client", () => {
    expect(() => createAdminClient({ SUPABASE_URL: "http://127.0.0.1:54321" })).toThrow(
      "SUPABASE_SECRET_KEY",
    );
  });
});
