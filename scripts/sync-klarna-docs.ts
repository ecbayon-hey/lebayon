import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const ROOT = "https://docs.klarna.com/klarna-network-distribution/";
export const SEEDS = [ROOT, "api/klarna-management-api/", "api/klarna-product-api-payment/", "api/klarna-product-api-network-session/", "api/klarna-notifications-api/", "api/klarna-product-api-identity/", "web-sdk/"].map((url) => new URL(url, ROOT).href);
export type DocChunk = { id: string; title: string; heading: string; url: string; text: string };
export type CrawlOptions = { maxPages?: number; concurrency?: number; delayMs?: number; minCharacters?: number; fetcher?: typeof fetch; seeds?: string[] };

export function valid(input: string, base = ROOT): string | null {
  try {
    const url = new URL(input, base); url.hash = ""; url.search = ""; url.hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.hostname !== "docs.klarna.com" || !url.pathname.startsWith(new URL(ROOT).pathname)) return null;
    url.pathname = url.pathname.replace(/\/{2,}/g, "/"); return url.href;
  } catch { return null; }
}
const clean = (value: string) => value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
type CheerioSelection = ReturnType<cheerio.CheerioAPI>;

function tableMarkdown($: cheerio.CheerioAPI, table: CheerioSelection) {
  const rows: string[][] = []; table.find("tr").each((_, row) => { rows.push($(row).find("th,td").map((__, cell) => clean($(cell).text())).get()); });
  if (!rows.length) return ""; const width = Math.max(...rows.map((row) => row.length)); const normalized = rows.map((row) => [...row, ...Array(width - row.length).fill("")]);
  return [normalized[0], Array(width).fill("---"), ...normalized.slice(1)].map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`).join("\n");
}
export function splitText(text: string, size = 1_800): string[] {
  const blocks = text.split(/\n{2,}/).map(clean).filter(Boolean); const chunks: string[] = []; let current = "";
  for (const block of blocks) { if (current && current.length + block.length + 2 > size) { chunks.push(current); current = ""; }
    if (block.length > size) { for (const line of block.match(new RegExp(`[\\s\\S]{1,${size}}(?:\\s|$)`, "g")) ?? [block]) { if (current) chunks.push(current); current = clean(line); } }
    else current += `${current ? "\n\n" : ""}${block}`;
  } if (current) chunks.push(current); return chunks;
}
const stableId = (url: string, heading: string, index: number) => createHash("sha256").update(`${url}\n${heading}\n${index}`).digest("hex").slice(0, 20);
export function extractPage(html: string, requestedUrl: string): { canonicalUrl: string; links: string[]; chunks: DocChunk[] } {
  const $ = cheerio.load(html); const canonicalUrl = valid($("link[rel='canonical']").first().attr("href") ?? "", requestedUrl) ?? valid(requestedUrl) ?? requestedUrl;
  const links = [...new Set($("a[href]").map((_, a) => valid($(a).attr("href") ?? "", canonicalUrl)).get().filter((url): url is string => Boolean(url)))];
  $("script,style,nav,header,footer,aside,noscript,svg").remove(); const main = $("main").first().length ? $("main").first() : $("article").first();
  const title = clean(main.find("h1").first().text()) || clean($("title").text()); let heading = title; let blocks: string[] = []; const chunks: DocChunk[] = [];
  const flush = () => { splitText(blocks.join("\n\n")).forEach((text, index) => chunks.push({ id: stableId(canonicalUrl, heading, index), title, heading, url: canonicalUrl, text })); blocks = []; };
  main.find("h1,h2,h3,h4,p,pre,table,li").each((_, element) => { if ($(element).parents("pre,table,li").length) return; const tag = element.tagName.toLowerCase();
    if (/^h[1-4]$/.test(tag)) { flush(); heading = clean($(element).text()) || heading; return; } let text = tag === "table" ? tableMarkdown($, $(element)) : clean($(element).text());
    if (tag === "pre" && text) text = `\`\`\`\n${text}\n\`\`\``; if (tag === "li" && text) text = `- ${text}`; if (text) blocks.push(text);
  }); flush(); return { canonicalUrl, links, chunks };
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function crawl(options: CrawlOptions = {}): Promise<DocChunk[]> {
  const maxPages = options.maxPages ?? Number(process.env.KN_DOCS_MAX_PAGES || 250); const concurrency = options.concurrency ?? Number(process.env.KN_DOCS_CONCURRENCY || 3); const delayMs = options.delayMs ?? Number(process.env.KN_DOCS_DELAY_MS || 250); const fetcher = options.fetcher ?? fetch;
  const queue = [...new Set((options.seeds ?? SEEDS).map((url) => valid(url)).filter((url): url is string => Boolean(url)))]; const scheduled = new Set(queue); const canonicalPages = new Set<string>(); const ids = new Set<string>(); const chunks: DocChunk[] = []; let visited = 0; let lastStarted = 0;
  async function worker() { while (visited < maxPages) { const url = queue.shift(); if (!url) return; visited++; const wait = Math.max(0, lastStarted + delayMs - Date.now()); if (wait) await sleep(wait); lastStarted = Date.now();
      try { const response = await fetcher(url, { headers: { "user-agent": "LeBayon documentation indexer (internal; respectful crawl)" } }); if (!response.ok) { console.warn(response.status, url); continue; } const page = extractPage(await response.text(), url); if (canonicalPages.has(page.canonicalUrl)) continue; canonicalPages.add(page.canonicalUrl); for (const chunk of page.chunks) if (!ids.has(chunk.id)) { ids.add(chunk.id); chunks.push(chunk); } for (const link of page.links) if (scheduled.size < maxPages && !scheduled.has(link)) { scheduled.add(link); queue.push(link); } console.log(`${visited}/${maxPages}`, page.canonicalUrl); } catch (error) { console.warn("Failed", url, error); }
    } }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker)); const characters = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0); const minimum = options.minCharacters ?? Number(process.env.KN_DOCS_MIN_CHARACTERS || 10_000);
  if (!chunks.length || characters < minimum) throw new Error(`Klarna sync extracted only ${chunks.length} chunks (${characters} characters); refusing to replace the corpus (minimum ${minimum}).`); return chunks;
}
export async function main() { const chunks = await crawl(); const output = path.join(process.cwd(), "knowledge/generated/klarna-docs.json"); await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, `${JSON.stringify(chunks, null, 2)}\n`); console.log(`Wrote ${chunks.length} chunks to ${output}`); }
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
