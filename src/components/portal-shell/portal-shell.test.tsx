import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { adminPortal, employeePortal } from "@/lib/navigation";

import { PortalShell } from "./portal-shell";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

function renderShell(portal = employeePortal) {
  return renderToStaticMarkup(
    <PortalShell portal={portal} userEmail="jordan.lee@example.com">
      <h1>Page content</h1>
    </PortalShell>,
  );
}

function currentPageLinks(html: string): string[] {
  return [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>([^<]*)<\/a>/g)].map(
    (match) => match[1],
  );
}

describe("PortalShell", () => {
  beforeEach(() => {
    navigation.pathname = "/chat";
  });

  it("starts with a skip link that targets the main landmark", () => {
    const html = renderShell();
    const firstLink = html.match(/<a [^>]*>[^<]*<\/a>/)?.[0];

    expect(firstLink).toContain('href="#main-content"');
    expect(firstLink).toContain("Skip to main content");
    expect(html).toMatch(/<main [^>]*id="main-content"[^>]*tabindex="-1"/);
  });

  it("renders header, labelled navigation, main and footer landmarks", () => {
    const html = renderShell(adminPortal);

    expect(html).toContain("<header");
    expect(html).toContain('<nav aria-label="HR administration">');
    expect(html).toContain("<main");
    expect(html).toContain("<footer");
  });

  it("links every navigation item for its portal", () => {
    const html = renderShell(adminPortal);

    for (const { href, label } of adminPortal.navigation) {
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain(`>${label}</a>`);
    }
  });

  it("marks exactly the current section with aria-current", () => {
    navigation.pathname = "/requests";
    expect(currentPageLinks(renderShell())).toEqual(["My Requests"]);
  });

  it("keeps a section current on pages nested beneath it", () => {
    navigation.pathname = "/admin/questions/q-1024";
    expect(currentPageLinks(renderShell(adminPortal))).toEqual(["Questions"]);
  });

  it("marks no section current on pages outside the navigation", () => {
    navigation.pathname = "/";
    expect(currentPageLinks(renderShell())).toEqual([]);
  });

  it("shows the signed-in user and a sign-out form that posts to the logout route", () => {
    const html = renderShell();

    expect(html).toContain("jordan.lee@example.com");
    expect(html).toMatch(
      /<form action="\/auth\/logout" method="post"><button [^>]*type="submit">Sign out<\/button><\/form>/,
    );
  });

  it("states that pages describe planned features and the data is fictional", () => {
    const html = renderShell();

    expect(html).toContain("pages describe planned features only");
    expect(html).not.toContain("sign-in is not enabled");
    expect(html).toContain("a fictional organization");
  });
});
