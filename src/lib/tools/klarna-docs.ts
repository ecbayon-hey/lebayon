import "server-only";
import { klarnaDocDomains, type KlarnaDocDomain } from "@/lib/knowledge/klarna-index";
import type { Source } from "@/lib/stream/events";
import * as cheerio from "cheerio";
import { discoverOfficialKlarnaUrls } from "./perplexity";

export { klarnaDocDomains };

const ROOT = "https://docs.klarna.com/klarna-network-distribution/";
const words = (value: string) => value.toLowerCase().match(/[a-z0-9][a-z0-9_-]+/g) ?? [];
const officialUrl = (input: string) => {
  try { const url = new URL(input, ROOT); url.hash = ""; url.search = ""; return url.origin === "https://docs.klarna.com" && url.href.startsWith(ROOT) ? url.href : null; } catch { return null; }
};

async function officialDiscovery(query: string, limit = 3) {
  const locations = new Set<string>();
  // Focused discovery URLs go first. Search output is never treated as evidence.
  for (const value of await discoverOfficialKlarnaUrls(query)) { const scoped = officialUrl(value); if (scoped) locations.add(scoped); }
  const sitemapQueue = ["https://docs.klarna.com/sitemap.xml", "https://docs.klarna.com/sitemap-index.xml", "https://docs.klarna.com/sitemap_index.xml"];
  const seen = new Set<string>();
  while (sitemapQueue.length && seen.size < 30) {
    const url = sitemapQueue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_500), cache: "no-store" });
      if (!response.ok) continue;
      const $ = cheerio.load(await response.text(), { xmlMode: true });
      $("loc").each((_, node) => {
        const value = $(node).text().trim();
        if (/\.xml(?:$|\?)/i.test(value)) sitemapQueue.push(new URL(value, url).href);
        else { const scoped = officialUrl(value); if (scoped) locations.add(scoped); }
      });
    } catch { /* Try application navigation metadata next. */ }
  }
  if (!locations.size) {
    try {
      const response = await fetch(ROOT, { signal: AbortSignal.timeout(5_500), cache: "no-store" });
      const html = (await response.text()).replace(/\\\//g, "/").replace(/\\u002[fF]/g, "/");
      for (const match of html.matchAll(/(?:https:\/\/docs\.klarna\.com)?\/klarna-network-distribution\/[a-zA-Z0-9_./%-]*/g)) {
        const scoped = officialUrl(match[0]); if (scoped) locations.add(scoped);
      }
    } catch { /* A controlled empty result is returned below. */ }
  }
  const terms = [...new Set(words(query).filter((word) => word.length > 2))];
  const ranked = [...locations].map((url, discoveryOrder) => ({ url, discoveryOrder, score: terms.reduce((sum, term) => sum + (decodeURIComponent(url).toLowerCase().includes(term) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.discoveryOrder - b.discoveryOrder).slice(0, Math.max(12, limit * 4));
  const pages = [];
  for (const candidate of ranked) {
    if (pages.length >= limit) break;
    try {
      const response = await fetch(candidate.url, { signal: AbortSignal.timeout(5_500), cache: "no-store" });
      if (!response.ok) continue;
      const $ = cheerio.load(await response.text()); $("script,style,nav,header,footer,aside,svg").remove();
      const main = $("main").first().length ? $("main").first() : $("article").first();
      const text = main.text().replace(/\s+/g, " ").trim();
      if (!text || !terms.some((term) => text.toLowerCase().includes(term))) continue;
      pages.push({ id: `live-${pages.length}`, title: main.find("h1").first().text().trim() || $("title").text().trim(), heading: main.find("h2").first().text().trim() || "Official documentation", url: candidate.url, text: text.slice(0, 8_000), score: candidate.score, evidence: "live" as const, liveVerified: true });
    } catch { /* Continue to the next official candidate. */ }
  }
  return pages;
}

export async function searchKlarnaDocs(query: string, domain: KlarnaDocDomain = "all") {
  // The bundled corpus is intentionally not consulted here—not even as fallback
  // evidence. Every KN request discovers and fetches the public docs afresh.
  const matches = await officialDiscovery(query);
  const sources: Source[] = matches.map((hit) => ({ type: "klarna", title: hit.title, heading: hit.heading, url: hit.url }));
  return {
    query,
    domain,
    matches,
    sources,
    note: matches.length ? "Evidence was extracted from public Klarna documentation fetched for this request." : "No current public Klarna documentation evidence could be fetched. The bundled snapshot was not used.",
  };
}
