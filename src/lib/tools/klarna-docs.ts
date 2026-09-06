import "server-only";
import * as cheerio from "cheerio";
import type { Source } from "@/lib/stream/events";

export const KLARNA_ROOT = "https://docs.klarna.com/klarna-network-distribution/";

export function officialKlarnaUrl(input: string) {
  try {
    const url = new URL(input);
    url.hash = "";
    return url.origin === "https://docs.klarna.com" && url.pathname.startsWith("/klarna-network-distribution/") ? url.href : null;
  } catch { return null; }
}

const compact = (value: string) => value.replace(/\s+/g, " ").trim();

export async function readKlarnaDocs(input: { url: string; search?: string }) {
  const url = officialKlarnaUrl(input.url);
  if (!url) throw new Error("URL must be within the official Klarna Network documentation.");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { Accept: "text/html" } });
  if (!response.ok) throw new Error(`Klarna documentation returned ${response.status}.`);
  const finalUrl = officialKlarnaUrl(response.url || url);
  if (!finalUrl) throw new Error("Klarna documentation redirected outside the allowed site.");

  const $ = cheerio.load(await response.text());
  $("script,style,nav,header,footer,aside,noscript,svg,form,button").remove();
  const root = $("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $("body");
  const title = compact(root.find("h1").first().text()) || compact($("title").text()) || "Klarna Network documentation";
  const sections: { heading: string; text: string }[] = [];
  let section = { heading: title, parts: [] as string[] };
  const flush = () => {
    const text = section.parts.join("\n").trim();
    if (text) sections.push({ heading: section.heading, text });
  };
  root.find("h1,h2,h3,h4,p,li,table,pre").each((_, element) => {
    const tag = element.tagName.toLowerCase();
    const text = compact($(element).text());
    if (!text) return;
    if (/^h[1-4]$/.test(tag)) { flush(); section = { heading: text, parts: [] }; }
    else section.parts.push(tag === "pre" ? `\`\`\`\n${text}\n\`\`\`` : text);
  });
  flush();

  const words = (input.search?.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length > 2);
  const ordered = words.length ? sections.map((value, index) => ({ value, index, relevant: words.some((word) => `${value.heading} ${value.text}`.toLowerCase().includes(word)) }))
    .sort((a, b) => Number(b.relevant) - Number(a.relevant) || a.index - b.index).map(({ value }) => value) : sections;
  const content = ordered.map(({ heading, text }) => `## ${heading}\n${text}`).join("\n\n").slice(0, 30_000);
  const links = new Map<string, string>();
  root.find("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    let absolute: string;
    try { absolute = new URL(href, finalUrl).href; } catch { return; }
    const official = officialKlarnaUrl(absolute);
    if (official && official !== finalUrl) links.set(official, compact($(element).text()) || official);
  });
  const internalLinks = [...links].slice(0, 100).map(([linkUrl, label]) => ({ title: label, url: linkUrl }));
  const sources: Source[] = [{ type: "klarna", title, url: finalUrl }];
  return { url: finalUrl, title, content, links: internalLinks, sources };
}
