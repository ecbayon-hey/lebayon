import { z } from "zod";
import type { ChatRequest } from "@/lib/validation/schemas";

export const routeDecisionSchema = z.object({
  domain: z.enum(["klarna", "general"]),
  freshness: z.enum(["static", "current"]),
  depth: z.enum(["brief", "normal", "deep"]),
  visual: z.enum(["none", "image", "chart", "mermaid"]),
  klarnaQueries: z.array(z.string().min(2).max(160)).max(3),
}).strict();
export type RouteDecision = z.infer<typeof routeDecisionSchema>;

const knTerms = /\b(klarna network|acquiring partner|authorizepayment|payment presentation|network session token|onwidgetcancel|onabort|klarna (?:web )?sdk|management api|network session api)\b/i;
const knContext = /\b(klarna network|acquiring partner|klarna (?:web )?sdk|payment (?:authorization|presentation)|network session)\b/i;
const currentTerms = /\b(today|tonight|this (?:week|weekend|month|year)|currently|current|latest|recent|right now|now\?|live|score|won|winner|weather|price|where does .+ live now)\b/i;
const deepTerms = /\b(complete|comprehensive|in depth|deep dive|step[- ]by[- ]step|walkthrough|full flow|sequence diagram|architecture diagram)\b/i;

const focusedQueries = (message: string) => {
  const queries: string[] = [];
  if (/mtls/i.test(message)) queries.push("mTLS Acquiring Partner requirement");
  if (/authorizepayment/i.test(message)) queries.push("authorizePayment payment authorization sequence");
  if (/onwidgetcancel|onabort/i.test(message)) queries.push("onWidgetCancel onAbort Web SDK callbacks");
  if (/network session token/i.test(message)) queries.push("Network Session Token");
  if (/payment presentation/i.test(message)) queries.push("Payment Presentation");
  if (/payment authorization|authorization flow/i.test(message)) queries.push("Payment Authorization flow");
  return [...new Set(queries.length ? queries : [message.replace(/\s+/g, " ").trim().slice(0, 160)])].slice(0, 3);
};

/** Deterministic routing keeps grounding policy out of the answer model's control. */
export function routeRequest(request: ChatRequest): RouteDecision {
  const latest = request.messages.at(-1)?.content ?? "";
  const prior = request.messages.slice(-7, -1).map((message) => message.content).join("\n");
  const domain = knTerms.test(latest) || (/\b(?:it|this|that|mtls|mandatory|required)\b/i.test(latest) && knContext.test(prior)) ? "klarna" : "general";
  const freshness = domain === "klarna" || currentTerms.test(latest) ? "current" : "static";
  const depth = deepTerms.test(latest) ? "deep" : /^(?:what|who|where|when|is|are|does|did|can|which)\b/i.test(latest.trim()) ? "brief" : "normal";
  const visual = /(?:sequence|flow) diagram|mermaid/i.test(latest) ? "mermaid" : /\bchart|graph\b/i.test(latest) ? "chart" : /\b(?:generate|create|draw) (?:an? )?(?:image|picture|illustration)\b/i.test(latest) ? "image" : "none";
  return routeDecisionSchema.parse({ domain, freshness, depth, visual, klarnaQueries: domain === "klarna" ? focusedQueries(latest) : [] });
}
