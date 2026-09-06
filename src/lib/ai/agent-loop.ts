import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import { withContext } from "./system-prompt";
import { toolDefinitions, executeTool } from "./tools";
import { routeRequest, type RouteDecision } from "./request-router";
import { loadEddyNotes } from "@/lib/knowledge/eddy-knowledge";
import { searchKlarnaDocs } from "@/lib/tools/klarna-docs";
import { searchWeb } from "@/lib/tools/perplexity";
import type { ChatRequest } from "@/lib/validation/schemas";
import type { StreamEvent, Source } from "@/lib/stream/events";
import { requiredSecret, optionalValue } from "@/lib/config/env";

const labels: Record<string, string> = { search_klarna_network_docs: "Checking the Klarna Network docs…", search_web: "Searching the wider web…", generate_image: "Generating that masterpiece…", create_chart: "Plotting the numbers…" };
const tokenBudget = (depth: RouteDecision["depth"]) => depth === "brief" ? 220 : depth === "normal" ? 700 : 2_400;

function emitSources(result: unknown, emit: (event: StreamEvent) => void) {
  if (result && typeof result === "object" && "sources" in result && Array.isArray(result.sources)) {
    for (const source of result.sources as Source[]) emit({ type: "source", source });
  }
}

async function retrieveBeforeAnswer(route: RouteDecision, latest: string, emit: (event: StreamEvent) => void) {
  if (route.domain === "klarna") {
    emit({ type: "tool_started", tool: "search_klarna_network_docs", label: labels.search_klarna_network_docs });
    const results = [];
    for (const query of route.klarnaQueries) {
      const result = await searchKlarnaDocs(query);
      results.push(result);
      emitSources(result, emit);
    }
    if (!results.some((result) => result.matches.length)) {
      const retry = await searchKlarnaDocs(`${latest} official Klarna Network documentation`);
      results.push(retry);
      emitSources(retry, emit);
    }
    emit({ type: "tool_finished", tool: "search_klarna_network_docs" });
    const matches = results.flatMap((result) => result.matches);
    console.info("KN retrieval", {
      route: route.domain,
      depth: route.depth,
      queries: results.map((result) => result.query),
      discoveredUrls: [...new Set(results.flatMap((result) => result.discoveredUrls))],
      fetchedUrls: [...new Set(matches.map((match) => match.url))],
      matchedHeadings: matches.map((match) => match.heading),
      evidenceSections: matches.length,
    });
    if (!matches.length) return null;
    return `CURRENT_KLARNA_DOCS\n${matches.map((match, index) => `SOURCE ${index + 1}\nURL: ${match.url}\nPAGE TITLE: ${match.title}\nSECTION: ${match.heading}\nCONTENT:\n${match.text}`).join("\n\n")}\nEND_CURRENT_KLARNA_DOCS`;
  }
  if (route.freshness === "current") {
    emit({ type: "tool_started", tool: "search_web", label: labels.search_web });
    const result = await searchWeb(latest);
    emitSources(result, emit);
    emit({ type: "tool_finished", tool: "search_web" });
    return `GENERAL_WEB_EVIDENCE\n${JSON.stringify(result)}\nEND_GENERAL_WEB_EVIDENCE`;
  }
  return "";
}

export async function runAgent(request: ChatRequest, emit: (event: StreamEvent) => void) {
  const client = new Anthropic({ apiKey: requiredSecret("ANTHROPIC_API_KEY") });
  const model = optionalValue("ANTHROPIC_MODEL", "claude-sonnet-4-5");
  let summary = request.summary;
  let recent = request.messages;
  if (recent.length > 16) {
    const old = recent.slice(0, -10);
    const compact = await client.messages.create({ model, max_tokens: 900, system: "Create a compact factual rolling conversation summary. Preserve decisions, constraints, unresolved questions and source conclusions. Do not add facts.", messages: [{ role: "user", content: `Previous summary:\n${summary || "None"}\n\nMessages:\n${old.map((message) => `${message.role}: ${message.content}`).join("\n")}` }] });
    summary = compact.content.filter((block) => block.type === "text").map((block) => block.text).join(" ");
    recent = recent.slice(-10);
    emit({ type: "summary_update", summary });
  }

  const route = routeRequest({ ...request, messages: recent });
  const latest = recent.at(-1)?.content ?? "";
  const evidence = await retrieveBeforeAnswer(route, latest, emit);
  if (route.domain === "klarna" && !evidence) {
    emit({ type: "text_delta", delta: "I couldn't retrieve the relevant Klarna Network docs just now." });
    return;
  }
  const messages: MessageParam[] = recent.map((message) => ({ role: message.role, content: message.content }));
  const system = withContext(summary ?? "", await loadEddyNotes(), route, evidence ?? undefined);
  // Retrieval tools are deliberately unavailable after mandatory orchestration;
  // the answer model cannot opt out of, replace, or repeat the grounding step.
  const answerTools = toolDefinitions.filter((tool) => !["search_klarna_network_docs", "search_web"].includes(tool.name));
  const limit = Math.min(4, Math.max(1, Number(process.env.MAX_TOOL_ITERATIONS) || 4));

  for (let iteration = 0; iteration < limit; iteration++) {
    const stream = client.messages.stream({ model, max_tokens: tokenBudget(route.depth), system, messages, tools: answerTools });
    let buffered = "";
    stream.on("text", (text) => { buffered += text; });
    const answer = await stream.finalMessage();
    messages.push({ role: "assistant", content: answer.content });
    const calls = answer.content.filter((block) => block.type === "tool_use");
    if (!calls.length) {
      if (buffered) emit({ type: "text_delta", delta: buffered });
      return;
    }
    // Any prose produced while selecting a tool is intentionally discarded.
    const results: ToolResultBlockParam[] = [];
    for (const call of calls) {
      emit({ type: "tool_started", tool: call.name, label: labels[call.name] || "Checking something…" });
      try {
        const result = await executeTool(call.name, call.input);
        emitSources(result, emit);
        if (result && typeof result === "object" && "chart" in result) emit({ type: "chart", chart: result.chart });
        if (result && typeof result === "object" && "url" in result && typeof result.url === "string") emit({ type: "image", url: result.url, alt: "alt" in result && typeof result.alt === "string" ? result.alt : "Generated image" });
        results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) });
      } catch (error) {
        results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: error instanceof Error ? error.message : "Tool failed" });
      } finally { emit({ type: "tool_finished", tool: call.name }); }
    }
    messages.push({ role: "user", content: results });
  }
  emit({ type: "text_delta", delta: "I hit the safe tool-call limit. Try narrowing the request." });
}
