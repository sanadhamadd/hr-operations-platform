import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home page", () => {
  const html = renderToStaticMarkup(<Home />);

  it("renders a single top-level heading with the product name", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain("<h1>HR Operations Platform</h1>");
  });

  it("states that features are not available yet", () => {
    expect(html).toContain("early application foundation");
    expect(html).toContain("not available yet");
  });
});
