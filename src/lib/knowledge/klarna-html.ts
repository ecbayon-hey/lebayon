import * as cheerio from "cheerio";
import type { DocChunk } from "./klarna-index";
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
export function extractRelevantSection(html: string, hit: DocChunk, limit = 5_000): string | null {
  const $ = cheerio.load(html); $("script,style,nav,header,footer,aside,noscript").remove(); const root = $("main").first().length ? $("main").first() : $("article").first();
  const headings = root.find("h1,h2,h3,h4").toArray(); const wanted = normalize(hit.heading).toLowerCase(); const exact = headings.find((node) => normalize($(node).text()).toLowerCase() === wanted); const terms = new Set(`${hit.heading} ${hit.text}`.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
  const candidates = (exact ? [exact] : headings).map((node) => { const level = Number(node.tagName.slice(1)); const blocks = [normalize($(node).text())]; let next = $(node).next(); while (next.length) { if (/^h[1-4]$/.test(next[0].tagName) && Number(next[0].tagName.slice(1)) <= level) break; const value = normalize(next.text()); if (value) blocks.push(value); next = next.next(); } const text = blocks.join("\n\n"); const score = [...terms].reduce((sum, term) => sum + (text.toLowerCase().includes(term) ? 1 : 0), 0); return { text, score }; });
  const relevant = candidates.sort((a, b) => b.score - a.score)[0]?.text; return relevant ? relevant.slice(0, limit) : null;
}
