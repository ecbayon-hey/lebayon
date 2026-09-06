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

/** Adds word boundaries to camelCase/joined product terms before classification. */
export function normalizeForRouting(value: string) {
  return value.normalize("NFKC")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/web\s*sdk/g, "web sdk")
    .replace(/authorize\s*payment/g, "authorize payment")
    .replace(/on\s*widget\s*(cancel|complete|error)/g, "on widget $1")
    .replace(/on\s*abort/g, "on abort")
    .replace(/m\s*tls/g, "mtls")
    .replace(/\s+/g, " ").trim();
}

const knTerms = /\b(klarna network|kn|knst|acquiring partner|authorize payment|payment (?:presentation|authorization)|network session(?: token| api)?|on widget (?:cancel|complete|error)|on abort|(?:klarna )?web sdk|management api|notifications api|identity api)\b/;
const knContext = /\b(klarna network|knst|acquiring partner|klarna web sdk|payment (?:authorization|presentation)|network session|management api|notifications api|identity api)\b/;
const currentTerms = /\b(today|yesterday|tonight|this (?:week|weekend|month|year)|currently|current|latest|recent|right now|now\?|live|score|won|winner|weather|price|where does .+ live now)\b/i;
const deepTerms = /\b(complete|comprehensive|in depth|deep dive|step[- ]by[- ]step|walkthrough|full flow|sequence diagram|architecture diagram)\b/i;

const focusedQueries = (message: string) => {
  const queries: string[] = [];
  const normalized = normalizeForRouting(message);
  if (/\bmtls\b/.test(normalized)) queries.push("mTLS Acquiring Partner requirement");
  if (/authorize payment/.test(normalized)) queries.push("authorizePayment Payment Authorization flow");
  if (/on widget cancel|on abort/.test(normalized)) queries.push("onWidgetCancel onAbort Web SDK callbacks");
  if (/network session token/i.test(message)) queries.push("Network Session Token");
  if (/payment presentation/i.test(message)) queries.push("Payment Presentation");
  if (/payment authorization|authorization flow/i.test(message)) queries.push("Payment Authorization flow");
  return [...new Set(queries.length ? queries : [message.replace(/\s+/g, " ").trim().slice(0, 160)])].slice(0, 3);
};

/** Deterministic routing keeps grounding policy out of the answer model's control. */
export function routeRequest(request: ChatRequest): RouteDecision {
  const latest = request.messages.at(-1)?.content ?? "";
  const normalized = normalizeForRouting(latest);
  const prior = normalizeForRouting(request.messages.slice(-7, -1).map((message) => message.content).join("\n"));
  const contextual = /\b(?:it|this|that|mtls|mandatory|required|flow|callback|token|sdk)\b/.test(normalized) && knContext.test(prior);
  const domain = knTerms.test(normalized) || contextual ? "klarna" : "general";
  const freshness = domain === "klarna" || currentTerms.test(latest) ? "current" : "static";
  const depth = deepTerms.test(latest) ? "deep" : /\b(?:explain|compare|troubleshoot|debug)\b/i.test(latest) ? "normal" : "brief";
  const visual = /(?:sequence|flow) diagram|mermaid/i.test(latest) ? "mermaid" : /\bchart|graph\b/i.test(latest) ? "chart" : /\b(?:generate|create|draw) (?:an? )?(?:image|picture|illustration)\b/i.test(latest) ? "image" : "none";
  return routeDecisionSchema.parse({ domain, freshness, depth, visual, klarnaQueries: domain === "klarna" ? focusedQueries(latest) : [] });
}
