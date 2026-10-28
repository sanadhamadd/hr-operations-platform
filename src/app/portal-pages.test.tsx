import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ChatPage from "@/app/(employee)/chat/page";
import FormsPage from "@/app/(employee)/forms/page";
import RequestsPage from "@/app/(employee)/requests/page";
import AnalyticsPage from "@/app/admin/analytics/page";
import InboxPage from "@/app/admin/inbox/page";
import AdminIndexPage from "@/app/admin/page";
import PeoplePage from "@/app/admin/people/page";
import QuestionsPage from "@/app/admin/questions/page";
import { adminPortal, employeePortal } from "@/lib/navigation";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));

const pagesByHref: Record<string, ComponentType> = {
  "/chat": ChatPage,
  "/forms": FormsPage,
  "/requests": RequestsPage,
  "/admin/inbox": InboxPage,
  "/admin/people": PeoplePage,
  "/admin/questions": QuestionsPage,
  "/admin/analytics": AnalyticsPage,
};

const navItems = [...employeePortal.navigation, ...adminPortal.navigation];

describe("portal pages", () => {
  it("covers every navigation destination", () => {
    expect(Object.keys(pagesByHref).sort()).toEqual(navItems.map((item) => item.href).sort());
  });

  it.each(navItems)("$label has one heading matching its navigation label", ({ href, label }) => {
    const html = renderToStaticMarkup(createPage(href));

    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(`>${label}</h1>`);
  });

  it.each(navItems)("$label is clearly marked as not yet available", ({ href }) => {
    const html = renderToStaticMarkup(createPage(href));

    expect(html).toContain("Not available yet");
    expect(html).toMatch(/<section [^>]*aria-labelledby="([^"]+)"[\s\S]*<h2 [^>]*id="\1"/);
    expect(html.match(/<li>/g)?.length).toBeGreaterThan(0);
  });

  it("redirects /admin to the HR Inbox", () => {
    AdminIndexPage();
    expect(redirect).toHaveBeenCalledWith("/admin/inbox");
  });
});

function createPage(href: string) {
  const Page = pagesByHref[href];
  return <Page />;
}
