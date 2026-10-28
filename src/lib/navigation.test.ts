import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { adminPortal, employeePortal, isActivePath } from "@/lib/navigation";

const appDir = fileURLToPath(new URL("../app", import.meta.url));

/** Converts app directory page files to their public URL paths, ignoring route groups. */
function appRoutePaths(): Set<string> {
  const pageFiles = readdirSync(appDir, { recursive: true, encoding: "utf8" }).filter((file) =>
    /(^|\/)page\.tsx$/.test(file),
  );

  return new Set(
    pageFiles.map((file) => {
      const segments = file
        .split("/")
        .slice(0, -1)
        .filter((segment) => !/^\(.+\)$/.test(segment));
      return `/${segments.join("/")}`;
    }),
  );
}

describe("portal navigation", () => {
  const portals = [employeePortal, adminPortal];
  const routes = appRoutePaths();

  it.each(portals)("$label links only to pages that exist", (portal) => {
    for (const { href } of portal.navigation) {
      expect(routes).toContain(href);
    }
    expect(routes).toContain(portal.homeHref);
  });

  it.each(portals)("$label has unique labels and destinations", (portal) => {
    const labels = portal.navigation.map((item) => item.label);
    const hrefs = portal.navigation.map((item) => item.href);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("keeps HR administration pages under /admin and employee pages outside it", () => {
    for (const { href } of adminPortal.navigation) {
      expect(href.startsWith("/admin/")).toBe(true);
    }
    for (const { href } of employeePortal.navigation) {
      expect(href.startsWith("/admin")).toBe(false);
    }
  });

  it("provides the agreed sections for each portal", () => {
    expect(employeePortal.navigation.map((item) => item.label)).toEqual([
      "Chat",
      "Forms",
      "My Requests",
    ]);
    expect(adminPortal.navigation.map((item) => item.label)).toEqual([
      "HR Inbox",
      "People",
      "Questions",
      "Analytics",
    ]);
  });
});

describe("isActivePath", () => {
  it("matches the exact page and pages nested beneath it", () => {
    expect(isActivePath("/admin/people", "/admin/people")).toBe(true);
    expect(isActivePath("/admin/people/invite", "/admin/people")).toBe(true);
  });

  it("does not match sibling pages that share a prefix", () => {
    expect(isActivePath("/forms-archive", "/forms")).toBe(false);
    expect(isActivePath("/admin/inbox", "/admin/people")).toBe(false);
  });
});
