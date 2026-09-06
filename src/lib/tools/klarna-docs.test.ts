import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { officialKlarnaUrl, readKlarnaDocs } from "./klarna-docs";

describe("read_klarna_docs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects every URL outside the Klarna Network documentation tree", () => {
    expect(officialKlarnaUrl("https://docs.klarna.com/klarna-network-distribution/web-sdk/")).toBeTruthy();
    expect(officialKlarnaUrl("https://docs.klarna.com/payments/")).toBeNull();
    expect(officialKlarnaUrl("https://example.com/klarna-network-distribution/")).toBeNull();
  });

  it("reads one live page, removes chrome, prioritizes matching sections, and returns official links", async () => {
    const url = "https://docs.klarna.com/klarna-network-distribution/web-sdk/";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`<nav>Navigation noise</nav><main><h1>Web SDK</h1><h2>Overview</h2><p>Introduction</p><h2>Launch</h2><p>Call initialize, then launch.</p><a href="setup/">Setup details</a><a href="https://example.com">Other</a></main>`, { headers: { "content-type": "text/html" } })));
    const result = await readKlarnaDocs({ url, search: "launch" });
    expect(result.content.indexOf("Launch")).toBeLessThan(result.content.indexOf("Overview"));
    expect(result.content).not.toContain("Navigation noise");
    expect(result.links).toEqual([{ title: "Setup details", url: `${url}setup/` }]);
  });
});
