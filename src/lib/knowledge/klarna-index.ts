import "server-only";
import MiniSearch from "minisearch";
import corpus from "../../../knowledge/generated/klarna-docs.json";

export const klarnaDocDomains = ["integration", "management", "payment", "network_session", "notifications", "identity", "web_sdk", "all"] as const;
export type KlarnaDocDomain = (typeof klarnaDocDomains)[number];
export type DocChunk = { id: string; title: string; heading: string; url: string; text: string };

const chunks = corpus as DocChunk[];
let search: MiniSearch<DocChunk> | undefined;

export function domainForUrl(url: string): Exclude<KlarnaDocDomain, "all"> {
  if (url.includes("klarna-management-api")) return "management";
  if (url.includes("klarna-product-api-network-session")) return "network_session";
  if (url.includes("klarna-product-api-payment")) return "payment";
  if (url.includes("klarna-notifications-api")) return "notifications";
  if (url.includes("klarna-product-api-identity")) return "identity";
  if (url.includes("/web-sdk/")) return "web_sdk";
  return "integration";
}

export function searchIndex(query: string, limit = 5, domain: KlarnaDocDomain = "all") {
  search ??= new MiniSearch<DocChunk>({
    fields: ["title", "heading", "text"],
    storeFields: ["title", "heading", "url", "text"],
    searchOptions: { boost: { title: 4, heading: 3, text: 1 }, fuzzy: 0.2, prefix: true },
  });
  if (search.documentCount === 0) search.addAll(chunks);

  const candidates = search.search(query);
  const filtered = domain === "all" ? candidates : candidates.filter((result) => domainForUrl(String(result.url)) === domain);
  return filtered.slice(0, limit).map((result) => ({
    id: String(result.id),
    title: String(result.title),
    heading: String(result.heading),
    url: String(result.url),
    text: String(result.text),
    score: result.score,
  }));
}
