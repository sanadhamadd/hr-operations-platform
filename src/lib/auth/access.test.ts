import { describe, expect, it } from "vitest";

import {
  decideAccess,
  homePathFor,
  isProtectedPath,
  parseMembership,
  type Membership,
  type Viewer,
} from "./access";

function viewer(membership: Membership | null): Viewer {
  return { userId: "00000000-0000-4000-8000-000000000001", email: "a@example.com", membership };
}

describe("decideAccess", () => {
  it.each([
    ["no session", null, "employee", "unauthenticated"],
    ["no session", null, "hr", "unauthenticated"],
    ["no membership", viewer(null), "employee", "no-membership"],
    ["no membership", viewer(null), "hr", "no-membership"],
    [
      "a disabled employee",
      viewer({ role: "employee", status: "disabled" }),
      "employee",
      "disabled",
    ],
    [
      "a disabled HR administrator",
      viewer({ role: "hr_admin", status: "disabled" }),
      "hr",
      "disabled",
    ],
    ["an active employee", viewer({ role: "employee", status: "active" }), "employee", "allow"],
    ["an active employee", viewer({ role: "employee", status: "active" }), "hr", "forbidden"],
    [
      "an active HR administrator",
      viewer({ role: "hr_admin", status: "active" }),
      "employee",
      "allow",
    ],
    ["an active HR administrator", viewer({ role: "hr_admin", status: "active" }), "hr", "allow"],
  ] as const)("gives %s in the %s area: %s", (_label, input, area, expected) => {
    expect(decideAccess(input, area)).toBe(expected);
  });
});

describe("parseMembership", () => {
  it("reads a single known membership row", () => {
    expect(parseMembership([{ role: "hr_admin", status: "active" }])).toEqual({
      role: "hr_admin",
      status: "active",
    });
  });

  it.each([
    ["no rows", []],
    ["null", null],
    ["an object instead of rows", { role: "hr_admin", status: "active" }],
    [
      "more than one row",
      [
        { role: "employee", status: "active" },
        { role: "hr_admin", status: "active" },
      ],
    ],
    ["an unknown role", [{ role: "owner", status: "active" }]],
    ["an unknown status", [{ role: "hr_admin", status: "pending" }]],
    ["a role with different case", [{ role: "HR_ADMIN", status: "active" }]],
  ])("treats %s as no membership", (_label, rows) => {
    expect(parseMembership(rows)).toBeNull();
  });
});

describe("homePathFor", () => {
  it("sends each role to its own portal", () => {
    expect(homePathFor("employee")).toBe("/chat");
    expect(homePathFor("hr_admin")).toBe("/admin/inbox");
  });
});

describe("isProtectedPath", () => {
  it.each([
    "/chat",
    "/forms",
    "/requests",
    "/admin",
    "/admin/people",
    "/api/session",
    "/api/admin/access",
  ])("protects %s", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each(["/", "/login", "/auth/confirm", "/access-denied", "/chatter", "/administrator"])(
    "does not require a session for %s",
    (path) => {
      expect(isProtectedPath(path)).toBe(false);
    },
  );
});
