import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import { withContext } from "./system-prompt";
import { toolDefinitions, executeTool } from "./tools";
import { loadEddyNotes } from "@/lib/knowledge/eddy-knowledge";
import type { ChatRequest } from "@/lib/validation/schemas";
import type { StreamEvent, Source } from "@/lib/stream/events";
import { requiredSecret, optionalValue } from "@/lib/config/env";

const labels: Record<string, string> = { read_klarna_docs: "Reading the Klarna Network docs…", search_web: "Searching the wider web…", generate_image: "Generating that masterpiece…", create_chart: "Plotting the numbers…" };

function emitSources(result: unknown, emit: (event: StreamEvent) => void) {
  if (result && typeof result === "object" && "sources" in result && Array.isArray(result.sources)) {
    for (const source of result.sources as Source[]) emit({ type: "source", source });
  }
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

  const messages: MessageParam[] = recent.map((message) => ({ role: message.role, content: message.content }));
  const system = withContext(summary ?? "", await loadEddyNotes());
  const limit = Math.min(4, Math.max(1, Number(process.env.MAX_TOOL_ITERATIONS) || 4));

  for (let iteration = 0; iteration < limit; iteration++) {
    const stream = client.messages.stream({ model, max_tokens: 1_200, system, messages, tools: toolDefinitions });
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
        if (call.name === "generate_image" && result && typeof result === "object" && "url" in result && typeof result.url === "string") emit({ type: "image", url: result.url, alt: "alt" in result && typeof result.alt === "string" ? result.alt : "Generated image" });
        results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) });
      } catch (error) {
        results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: error instanceof Error ? error.message : "Tool failed" });
      } finally { emit({ type: "tool_finished", tool: call.name }); }
    }
    messages.push({ role: "user", content: results });
  }
  emit({ type: "text_delta", delta: "I hit the safe tool-call limit. Try narrowing the request." });
}
