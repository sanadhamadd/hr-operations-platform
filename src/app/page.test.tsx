import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";
import { adminPortal, employeePortal } from "@/lib/navigation";

describe("Home page", () => {
  const html = renderToStaticMarkup(<Home />);

  it("renders a single top-level heading with the product name", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(">HR Operations Platform</h1>");
  });

  it("states that features are not available yet", () => {
    expect(html).toContain("early application foundation");
    expect(html).toContain("not available yet");
  });

  it("links to both portals", () => {
    for (const portal of [employeePortal, adminPortal]) {
      expect(html).toContain(`href="${portal.homeHref}"`);
      expect(html).toContain(`>${portal.label}</a>`);
    }
  });

  it("links to sign-in and states that access depends on the account's role", () => {
    expect(html).toContain('href="/login"');
    expect(html).toContain("only to the roles it");
    expect(html).not.toContain("Sign-in is not enabled");
  });

  it("states that the organization is fictional", () => {
    expect(html).toContain("a fictional organization");
  });
});
