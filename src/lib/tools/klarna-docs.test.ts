import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./perplexity", () => ({ discoverOfficialKlarnaUrls: vi.fn().mockResolvedValue([]) }));

import { searchKlarnaDocs } from "./klarna-docs";

describe("live Klarna evidence", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses only text fetched from a current public documentation URL", async () => {
    const page = "https://docs.klarna.com/klarna-network-distribution/security/mtls/";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("sitemap.xml")) return new Response(`<urlset><url><loc>${page}</loc></url></urlset>`, { status: 200 });
      if (url.includes("sitemap-")) return new Response("", { status: 404 });
      if (url === page) return new Response("<main><h1>Connection security</h1><h2>mTLS</h2><p>LIVE_ONLY_MARKER mTLS is required for this connection.</p></main>", { status: 200 });
      return new Response("", { status: 404 });
    }));

    const result = await searchKlarnaDocs("mTLS requirement");

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ url: page, evidence: "live", liveVerified: true });
    expect(result.matches[0].text).toContain("LIVE_ONLY_MARKER");
    expect(JSON.stringify(result)).not.toContain("bundled-stale");
  });
});
