import "server-only";
import { klarnaDocDomains, searchIndex, type KlarnaDocDomain } from "@/lib/knowledge/klarna-index";
import { extractRelevantSection } from "@/lib/knowledge/klarna-html";
import type { Source } from "@/lib/stream/events";

export { klarnaDocDomains };

export async function searchKlarnaDocs(query: string, domain: KlarnaDocDomain = "all") {
  const hits = searchIndex(query, 5, domain);
  const selected = hits.slice(0, 3);
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
  const sources: Source[] = verified.map((hit) => ({ type: "klarna", title: hit.title, heading: hit.heading, url: hit.url }));
  return {
    query,
    domain,
    matches: verified,
    sources,
    note: "live means the canonical page was fetched and its matching section extracted; bundled-stale is snapshot fallback evidence after live verification failed.",
  };
}
