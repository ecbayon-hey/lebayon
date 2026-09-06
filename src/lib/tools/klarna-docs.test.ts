import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./perplexity", () => ({ discoverOfficialKlarnaUrls: vi.fn().mockResolvedValue([]) }));

import { searchKlarnaDocs } from "./klarna-docs";
import { extractSections } from "./klarna-docs";
import { KLARNA_AREA_ROOTS } from "./klarna-docs";

describe("live Klarna evidence", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses only text fetched from a current public documentation URL", async () => {
    const page = "https://docs.klarna.com/klarna-network-distribution/security/mtls/";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "https://docs.klarna.com/klarna-network-distribution/") return new Response(`<main><a href="${page}">mTLS</a></main>`, { status: 200 });
      if (url === page) return new Response("<main><h1>Connection security</h1><h2>mTLS</h2><p>LIVE_ONLY_MARKER mTLS is required for this connection.</p></main>", { status: 200 });
      return new Response("", { status: 404 });
    }));

    const result = await searchKlarnaDocs("mTLS requirement");

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ url: page, evidence: "live", liveVerified: true });
    expect(result.matches[0].text).toContain("LIVE_ONLY_MARKER");
    expect(JSON.stringify(result)).not.toContain("bundled-stale");
  });

  it("ranks a matching semantic section beyond a long page introduction", () => {
    const sections = extractSections(`<main><h1>API</h1><p>${"introduction ".repeat(2_000)}</p><h2>authorizePayment</h2><pre>authorizePayment(request)</pre><p>Payment Authorization flow.</p></main>`, "authorizePayment Payment Authorization");
    expect(sections[0].heading).toBe("authorizePayment");
    expect(sections[0].content).toContain("Payment Authorization flow");
    expect(sections[0].content).not.toContain("introduction");
  });

  it.each(["the websdk", "no i just cant remember how to launch the websdk", "how do I initialize WebSDK"])("fetches Web SDK first for %s", async (query) => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input); calls.push(url);
      if (url === KLARNA_AREA_ROOTS.web_sdk) return new Response("<main><h1>Web SDK</h1><h2>Initialize the Web SDK</h2><p>Load the script and initialize KlarnaSDK with your client configuration.</p></main>");
      return new Response("<main><h1>Build the onboarding payload</h1><p>Disputes onboarding.</p></main>");
    }));
    const result = await searchKlarnaDocs(query, "web_sdk");
    expect(calls[0]).toBe(KLARNA_AREA_ROOTS.web_sdk);
    expect(result.domain).toBe("web_sdk");
    expect(result.matches[0].url).toBe(KLARNA_AREA_ROOTS.web_sdk);
    expect(JSON.stringify(result.sources)).not.toMatch(/disputes|onboarding/i);
  });
});
