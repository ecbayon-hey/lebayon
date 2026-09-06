import "server-only";
import * as cheerio from "cheerio";
import type { Source } from "@/lib/stream/events";
import { discoverOfficialKlarnaUrls } from "./perplexity";

export const KLARNA_ROOT = "https://docs.klarna.com/klarna-network-distribution/";
export const KLARNA_ROOTS = [
  KLARNA_ROOT,
  `${KLARNA_ROOT}api/klarna-management-api/`,
  `${KLARNA_ROOT}api/klarna-product-api-payment/`,
  `${KLARNA_ROOT}api/klarna-product-api-network-session/`,
  `${KLARNA_ROOT}api/klarna-notifications-api/`,
  `${KLARNA_ROOT}api/klarna-product-api-identity/`,
  `${KLARNA_ROOT}web-sdk/`,
] as const;

export const klarnaDocDomains = ["integration", "management", "payment", "network_session", "notifications", "identity", "web_sdk", "all"] as const;
export type KlarnaDocDomain = (typeof klarnaDocDomains)[number];
type Section = { heading: string; content: string; score: number };
type FetchedPage = { url: string; title: string; sections: Section[] };
const present = <T,>(value: T | null): value is T => value !== null;

export function officialKlarnaUrl(input: string) {
  try {
    const url = new URL(input, KLARNA_ROOT);
    url.hash = ""; url.search = "";
    return url.protocol === "https:" && url.hostname === "docs.klarna.com" && url.pathname.startsWith("/klarna-network-distribution/") ? url.href : null;
  } catch { return null; }
}

const tokenize = (value: string) => [...new Set(value.toLowerCase().replace(/([a-z])([A-Z])/g, "$1 $2").match(/[a-z0-9]{3,}/g) ?? [])];
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

/** Extract semantic heading sections, retaining prose, lists, tables, and code. */
export function extractSections(html: string, query: string, limit = 3): Section[] {
  const $ = cheerio.load(html);
  $("script,style,nav,header,footer,aside,noscript,svg").remove();
  const root = $("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $("body");
  const terms = tokenize(query);
  const sections: Section[] = [];
  let current = { heading: normalize(root.find("h1").first().text()) || "Official documentation", parts: [] as string[] };
  const flush = () => {
    const content = current.parts.join("\n").trim();
    if (!content) return;
    const searchable = `${current.heading} ${content}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (searchable.includes(term) ? (current.heading.toLowerCase().includes(term) ? 5 : 1) : 0), 0);
    sections.push({ heading: current.heading, content, score });
  };
  root.find("h1,h2,h3,h4,p,li,table,pre,code").each((_, element) => {
    const tag = element.tagName.toLowerCase();
    const text = normalize($(element).text());
    if (!text) return;
    if (/^h[1-4]$/.test(tag)) { flush(); current = { heading: text, parts: [] }; }
    else if (tag !== "code" || !$(element).parents("pre").length) current.parts.push(tag === "pre" || tag === "code" ? `\`\`\`\n${text}\n\`\`\`` : text);
  });
  flush();
  return sections.filter((section) => section.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

async function fetchPage(url: string, query: string): Promise<FetchedPage | null> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000), headers: { Accept: "text/html" } });
  if (!response.ok) return null;
  const html = await response.text();
  const $ = cheerio.load(html);
  const sections = extractSections(html, query);
  if (!sections.length) return null;
  return { url, title: normalize($("h1").first().text()) || normalize($("title").text()) || "Klarna Network documentation", sections };
}

async function navigationUrls(query: string) {
  const urls = new Set<string>(KLARNA_ROOTS);
  const terms = tokenize(query);
  for (const root of KLARNA_ROOTS) {
    try {
      const response = await fetch(root, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (!response.ok) continue;
      const html = (await response.text()).replace(/\\u002[fF]/g, "/").replace(/\\\//g, "/");
      const $ = cheerio.load(html);
      $("a[href]").each((_, link) => { const url = officialKlarnaUrl($(link).attr("href") ?? ""); if (url) urls.add(url); });
      for (const match of html.matchAll(/(?:https:\/\/docs\.klarna\.com)?\/klarna-network-distribution\/[a-zA-Z0-9_./%-]*/g)) { const url = officialKlarnaUrl(match[0]); if (url) urls.add(url); }
    } catch { /* Another root or URL discovery can still succeed. */ }
  }
  return [...urls].map((url) => ({ url, score: terms.reduce((n, term) => n + (decodeURIComponent(url).toLowerCase().includes(term) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score).slice(0, 16).map(({ url }) => url);
}

export async function searchKlarnaDocs(query: string, domain: KlarnaDocDomain = "all") {
  const discovered = new Set(await navigationUrls(query));
  let pages = (await Promise.all([...discovered].slice(0, 8).map(async (url) => { try { return await fetchPage(url, query); } catch { return null; } }))).filter(present);
  if (!pages.length) {
    for (const value of await discoverOfficialKlarnaUrls(query)) { const url = officialKlarnaUrl(value); if (url) discovered.add(url); }
    pages = (await Promise.all([...discovered].slice(-8).map(async (url) => { try { return await fetchPage(url, query); } catch { return null; } }))).filter(present);
  }
  const matches = pages.flatMap((page) => page.sections.map((section) => ({ title: page.title, heading: section.heading, url: page.url, text: section.content.slice(0, 6_000), score: section.score, evidence: "live" as const, liveVerified: true })))
    .sort((a, b) => b.score - a.score).slice(0, 4);
  const sources: Source[] = [...new Map(matches.map((hit) => [hit.url, { type: "klarna" as const, title: hit.title, heading: hit.heading, url: hit.url }])).values()];
  return { query, domain, matches, sources, discoveredUrls: [...discovered] };
}
