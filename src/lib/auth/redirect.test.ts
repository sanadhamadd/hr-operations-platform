import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it.each(["/chat", "/admin/people", "/requests?status=open", "/forms#section"])(
    "keeps the same-site path %s",
    (target) => {
      expect(safeRedirectPath(target, "/fallback")).toBe(target);
    },
  );

  it.each([
    "https://evil.example",
    "http://evil.example/chat",
    "//evil.example",
    "//evil.example/chat",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "data:text/html,hello",
    "chat",
    "",
    " /chat",
  ])("rejects %j", (target) => {
    expect(safeRedirectPath(target, "/fallback")).toBe("/fallback");
  });

  it.each([undefined, null, 42, ["/chat"], { href: "/chat" }])(
    "rejects the non-string value %j",
    (target) => {
      expect(safeRedirectPath(target, null)).toBeNull();
    },
  );

  it("normalizes dot segments without leaving the site", () => {
    expect(safeRedirectPath("/chat/../../admin", "/fallback")).toBe("/admin");
  });

  it("keeps encoded slashes inside the path", () => {
    expect(safeRedirectPath("/%2F%2Fevil.example", "/fallback")).toBe("/%2F%2Fevil.example");
  });
});
