import { describe, expect, it, vi } from "vitest";
import { ChatStreamError, consumeChatStream } from "./sse";

function fragmented(...chunks: string[]) {
  return new ReadableStream<Uint8Array>({start(c){chunks.forEach(x=>c.enqueue(new TextEncoder().encode(x)));c.close();}});
}
describe("consumeChatStream",()=>{
  it("reassembles fragmented SSE and final unterminated records",async()=>{const seen=vi.fn();await consumeChatStream(fragmented("data: {\"type\":\"text_","delta\",\"delta\":\"G'day ☕\"}\n\ndata: {\"type\":\"done\"}"),seen);expect(seen.mock.calls.map(c=>c[0].type)).toEqual(["text_delta","done"]);expect(seen.mock.calls[0][0].delta).toBe("G'day ☕")});
  it("rejects malformed and server error events",async()=>{await expect(consumeChatStream(fragmented("data: nope\n\n"),vi.fn())).rejects.toBeInstanceOf(ChatStreamError);await expect(consumeChatStream(fragmented('data: {"type":"error","message":"provider down"}\n\n'),vi.fn())).rejects.toThrow("provider down")});
});
