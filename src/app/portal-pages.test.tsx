import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChatPage from "@/app/(employee)/chat/page";
import FormsPage from "@/app/(employee)/forms/page";
import EmployeeLayout from "@/app/(employee)/layout";
import RequestsPage from "@/app/(employee)/requests/page";
import AnalyticsPage from "@/app/admin/analytics/page";
import InboxPage from "@/app/admin/inbox/page";
import AdminLayout from "@/app/admin/layout";
import AdminIndexPage from "@/app/admin/page";
import PeoplePage from "@/app/admin/people/page";
import QuestionsPage from "@/app/admin/questions/page";
import { adminPortal, employeePortal } from "@/lib/navigation";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireEmployeeAccess: vi.fn(),
  requireHrAccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, usePathname: () => "/" }));
vi.mock("@/lib/auth/session", () => ({
  requireEmployeeAccess: mocks.requireEmployeeAccess,
  requireHrAccess: mocks.requireHrAccess,
}));

type AsyncPage = () => Promise<ReactElement>;

const employeePages: Record<string, AsyncPage> = {
  "/chat": ChatPage,
  "/forms": FormsPage,
  "/requests": RequestsPage,
};

const adminPages: Record<string, AsyncPage> = {
  "/admin/inbox": InboxPage,
  "/admin/people": PeoplePage,
  "/admin/questions": QuestionsPage,
  "/admin/analytics": AnalyticsPage,
};

const pagesByHref = { ...employeePages, ...adminPages };
const navItems = [...employeePortal.navigation, ...adminPortal.navigation];
const viewer = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "jordan.lee@example.com",
  membership: { role: "hr_admin", status: "active" },
};

// Stands in for the redirect that the real guard throws when access is denied.
class AccessDenied extends Error {}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireEmployeeAccess.mockResolvedValue(viewer);
  mocks.requireHrAccess.mockResolvedValue(viewer);
});

describe("portal pages", () => {
  it("covers every navigation destination", () => {
    expect(Object.keys(pagesByHref).sort()).toEqual(navItems.map((item) => item.href).sort());
  });

  it("covers every page file in the protected route folders", () => {
    const pageFiles = [
      ...findPageFiles(join(process.cwd(), "src/app/(employee)")),
      ...findPageFiles(join(process.cwd(), "src/app/admin")),
    ].map((path) => relative(join(process.cwd(), "src/app"), path));

    expect(pageFiles.sort()).toEqual(
      [
        "(employee)/chat/page.tsx",
        "(employee)/forms/page.tsx",
        "(employee)/requests/page.tsx",
        "admin/analytics/page.tsx",
        "admin/inbox/page.tsx",
        "admin/page.tsx",
        "admin/people/page.tsx",
        "admin/questions/page.tsx",
      ].sort(),
    );
  });

  it.each(navItems)(
    "$label has one heading matching its navigation label",
    async ({ href, label }) => {
      const html = renderToStaticMarkup(await pagesByHref[href]());

      expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
      expect(html).toContain(`>${label}</h1>`);
    },
  );

  it.each(navItems)("$label is clearly marked as not yet available", async ({ href }) => {
    const html = renderToStaticMarkup(await pagesByHref[href]());

    expect(html).toContain("Not available yet");
    expect(html).toMatch(/<section [^>]*aria-labelledby="([^"]+)"[\s\S]*<h2 [^>]*id="\1"/);
    expect(html.match(/<li>/g)?.length).toBeGreaterThan(0);
  });

  it("redirects /admin to the HR Inbox after checking HR access", async () => {
    await AdminIndexPage();

    expect(mocks.requireHrAccess).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/inbox");
  });
});

describe("page access checks", () => {
  it.each(Object.entries(employeePages))(
    "%s requires employee portal access",
    async (_href, Page) => {
      await Page();

      expect(mocks.requireEmployeeAccess).toHaveBeenCalledOnce();
      expect(mocks.requireHrAccess).not.toHaveBeenCalled();
    },
  );

  it.each(Object.entries(adminPages))("%s requires HR access", async (_href, Page) => {
    await Page();

    expect(mocks.requireHrAccess).toHaveBeenCalledOnce();
    expect(mocks.requireEmployeeAccess).not.toHaveBeenCalled();
  });

  it.each(Object.entries(employeePages))(
    "%s renders nothing when access is denied",
    async (_href, Page) => {
      mocks.requireEmployeeAccess.mockRejectedValue(new AccessDenied());

      await expect(Page()).rejects.toBeInstanceOf(AccessDenied);
    },
  );

  it.each(Object.entries(adminPages))(
    "%s renders nothing when HR access is denied",
    async (_href, Page) => {
      mocks.requireHrAccess.mockRejectedValue(new AccessDenied());

      await expect(Page()).rejects.toBeInstanceOf(AccessDenied);
    },
  );

  it("does not redirect /admin when HR access is denied", async () => {
    mocks.requireHrAccess.mockRejectedValue(new AccessDenied());

    await expect(AdminIndexPage()).rejects.toBeInstanceOf(AccessDenied);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("checks access in both portal layouts and shows the signed-in user", async () => {
    const employeeHtml = renderToStaticMarkup(await EmployeeLayout({ children: null } as never));
    const adminHtml = renderToStaticMarkup(await AdminLayout({ children: null } as never));

    expect(mocks.requireEmployeeAccess).toHaveBeenCalledOnce();
    expect(mocks.requireHrAccess).toHaveBeenCalledOnce();
    expect(employeeHtml).toContain(viewer.email);
    expect(adminHtml).toContain(viewer.email);
  });

  it("checks HR access in the HR layout before rendering", async () => {
    mocks.requireHrAccess.mockRejectedValue(new AccessDenied());

    await expect(AdminLayout({ children: null } as never)).rejects.toBeInstanceOf(AccessDenied);
  });
});

function findPageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findPageFiles(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}
