import "server-only";
import { klarnaDocDomains, searchIndex, type KlarnaDocDomain } from "@/lib/knowledge/klarna-index";
import { extractRelevantSection } from "@/lib/knowledge/klarna-html";
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
  const sitemapQueue = ["https://docs.klarna.com/sitemap.xml", "https://docs.klarna.com/sitemap-index.xml", "https://docs.klarna.com/sitemap_index.xml"];
  const seen = new Set<string>();
  while (sitemapQueue.length && seen.size < 30) {
    const url = sitemapQueue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_500), next: { revalidate: 3600 } });
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
      const response = await fetch(ROOT, { signal: AbortSignal.timeout(5_500), next: { revalidate: 3600 } });
      const html = (await response.text()).replace(/\\\//g, "/").replace(/\\u002[fF]/g, "/");
      for (const match of html.matchAll(/(?:https:\/\/docs\.klarna\.com)?\/klarna-network-distribution\/[a-zA-Z0-9_./%-]*/g)) {
        const scoped = officialUrl(match[0]); if (scoped) locations.add(scoped);
      }
    } catch { /* A controlled empty result is returned below. */ }
  }
  // Perplexity is permitted only to discover an official URL. Its prose is
  // discarded; any evidence below is extracted from a direct Klarna fetch.
  if (!locations.size || ![...locations].some((url) => words(query).some((term) => decodeURIComponent(url).toLowerCase().includes(term)))) {
    for (const value of await discoverOfficialKlarnaUrls(query)) { const scoped = officialUrl(value); if (scoped) locations.add(scoped); }
  }
  const terms = [...new Set(words(query).filter((word) => word.length > 2))];
  const ranked = [...locations].map((url) => ({ url, score: terms.reduce((sum, term) => sum + (decodeURIComponent(url).toLowerCase().includes(term) ? 1 : 0), 0) }))
    .filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit * 3);
  const pages = [];
  for (const candidate of ranked) {
    if (pages.length >= limit) break;
    try {
      const response = await fetch(candidate.url, { signal: AbortSignal.timeout(5_500), next: { revalidate: Number(process.env.KN_DOCS_REVALIDATE_SECONDS || 3600) } });
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
  const hits = searchIndex(query, 5, domain);
  const queryTerms = words(query).filter((word) => word.length > 2);
  const selected = hits.filter((hit) => queryTerms.some((term) => `${hit.title} ${hit.heading} ${hit.text}`.toLowerCase().includes(term))).slice(0, 3);
  const verified = await Promise.all(selected.map(async (hit) => {
    try {
      const response = await fetch(hit.url, {
        signal: AbortSignal.timeout(5_500),
        next: { revalidate: Number(process.env.KN_DOCS_REVALIDATE_SECONDS || 3600) },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = extractRelevantSection(await response.text(), hit);
      if (!text) throw new Error("Matching section was not present in the live page");
      return { ...hit, text, evidence: "live" as const, liveVerified: true };
    } catch {
      return { ...hit, evidence: "bundled-stale" as const, liveVerified: false };
    }
  }));
  // MiniSearch scores are query-relative. Zero relevant hits or only a very weak
  // best hit triggers restricted discovery; fallback evidence is always fetched
  // from the canonical official page and never from a search-engine summary.
  const fallback = selected.length === 0 || (selected[0]?.score ?? 0) < 2 ? await officialDiscovery(query) : [];
  const matches = fallback.length ? fallback : verified;
  const sources: Source[] = matches.map((hit) => ({ type: "klarna", title: hit.title, heading: hit.heading, url: hit.url }));
  return {
    query,
    domain,
    matches,
    sources,
    note: fallback.length ? "The local corpus was weak, so current pages were discovered within the official Klarna Network documentation path and fetched directly." : "live means the canonical page was fetched and its matching section extracted; bundled-stale is snapshot fallback evidence after live verification failed.",
  };
}
