import type { StreamEvent } from "./events";

export class ChatStreamError extends Error {}

/** Consume an SSE response even when records or UTF-8 characters cross chunks. */
export async function consumeChatStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (record: string) => {
    const data = record.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    let event: StreamEvent;
    try { event = JSON.parse(data) as StreamEvent; }
    catch { throw new ChatStreamError("The chat service sent a malformed stream event."); }
    if (!event || typeof event !== "object" || typeof event.type !== "string")
      throw new ChatStreamError("The chat service sent an invalid stream event.");
    onEvent(event);
    if (event.type === "error") throw new ChatStreamError(event.message);
  };
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const records = buffer.split(/\r?\n\r?\n/);
    buffer = records.pop() || "";
    records.forEach(parse);
    if (done) break;
  }
  if (buffer.trim()) parse(buffer);
}
