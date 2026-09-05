import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { POST } from "./route";

describe("POST /api/transcribe", () => {
  beforeEach(() => { process.env.MISTRAL_API_KEY = "server-secret"; process.env.MISTRAL_STT_MODEL = "voxtral-mini-latest"; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.MISTRAL_API_KEY; delete process.env.MISTRAL_STT_MODEL; });
  const request = (file?: File) => { const data = new FormData(); if (file) data.append("file", file); return new Request("http://local/api/transcribe", { method: "POST", body: data }); };
  it("validates files before contacting Mistral", async () => { expect((await POST(request())).status).toBe(400); expect((await POST(request(new File(["x"], "x.txt", { type: "text/plain" })))).status).toBe(415); });
  it("sends audio, the model, and Klarna context bias server-side", async () => {
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => { expect(init.headers).toEqual({ Authorization: "Bearer server-secret" }); const body = init.body as FormData; expect(body.get("model")).toBe("voxtral-mini-latest"); expect(String(body.get("context_bias"))).toContain("authorizePayment"); expect(String(body.get("context_bias"))).toContain("onWidgetCancel"); return Response.json({ text: "Klarna Network transcript" }); });
    vi.stubGlobal("fetch", fetcher); const response = await POST(request(new File(["audio"], "clip.webm", { type: "audio/webm;codecs=opus" }))); expect(response.status).toBe(200); expect(await response.json()).toEqual({ text: "Klarna Network transcript" });
  });
  it("does not expose provider failures", async () => { vi.stubGlobal("fetch", vi.fn(async () => new Response('{"secret":"provider detail"}', { status: 400 }))); const response = await POST(request(new File(["audio"], "clip.webm", { type: "audio/webm" }))); expect(response.status).toBe(502); expect(JSON.stringify(await response.json())).not.toContain("provider detail"); });
});
