import { describe, expect, it } from "vitest";

import { isSameOriginRequest } from "./request-origin";

function post(headers: Record<string, string>) {
  return new Request("http://127.0.0.1:3000/auth/login", { method: "POST", headers });
}

describe("isSameOriginRequest", () => {
  it("accepts a request from the same host", () => {
    expect(
      isSameOriginRequest(post({ origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" })),
    ).toBe(true);
    expect(
      isSameOriginRequest(
        post({
          origin: "http://127.0.0.1:3000",
          host: "127.0.0.1:3000",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ["another origin", { origin: "https://evil.example", host: "127.0.0.1:3000" }],
    ["another port", { origin: "http://127.0.0.1:4000", host: "127.0.0.1:3000" }],
    ["no origin", { host: "127.0.0.1:3000" }],
    ["an opaque origin", { origin: "null", host: "127.0.0.1:3000" }],
    [
      "a cross-site fetch",
      { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000", "sec-fetch-site": "cross-site" },
    ],
  ])("rejects %s", (_label, headers) => {
    expect(isSameOriginRequest(post(headers))).toBe(false);
  });
});
