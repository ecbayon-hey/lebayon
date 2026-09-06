import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const complete = vi.fn();
vi.mock("@mistralai/mistralai", () => ({ Mistral: class { audio = { transcriptions: { complete } }; } }));
import { POST } from "./route";

describe("POST /api/transcribe", () => {
  beforeEach(() => { process.env.MISTRAL_API_KEY = "server-secret"; process.env.MISTRAL_STT_MODEL = "voxtral-mini-latest"; });
  afterEach(() => { delete process.env.MISTRAL_API_KEY; delete process.env.MISTRAL_STT_MODEL; complete.mockReset(); });
  const request = (file?: File) => { const data = new FormData(); if (file) data.append("file", file); return new Request("http://local/api/transcribe", { method: "POST", body: data }); };
  it("validates files before contacting Mistral", async () => { expect((await POST(request())).status).toBe(400); expect((await POST(request(new File(["x"], "x.txt", { type: "text/plain" })))).status).toBe(415); });
  it("rejects an empty recording", async () => { expect((await POST(request(new File([], "empty.wav", { type: "audio/wav" })))).status).toBe(400); expect(complete).not.toHaveBeenCalled(); });
  it("sends audio, the model, and Klarna context bias server-side", async () => {
    complete.mockImplementation(async (input: { model: string; language: string; contextBias: string[] }) => { expect(input.model).toBe("voxtral-mini-latest"); expect(input.language).toBe("en"); expect(input.contextBias).toContain("authorizePayment"); expect(input.contextBias).toContain("onWidgetCancel"); expect(Array.isArray(input.contextBias)).toBe(true); return { text: "Klarna Network transcript" }; });
    const response = await POST(request(new File(["audio"], "clip.webm", { type: "audio/webm;codecs=opus" }))); expect(response.status).toBe(200); expect(await response.json()).toEqual({ text: "Klarna Network transcript" });
  });
  it.each(["audio/ogg", "audio/wav"])("accepts %s", async (type: string) => { complete.mockResolvedValue({ text: "ok" }); expect((await POST(request(new File(["audio"], `clip.${type.split("/")[1]}`, { type })))).status).toBe(200); });
  it("never accepts MP4 directly", async () => { expect((await POST(request(new File(["audio"], "clip.m4a", { type: "audio/mp4" })))).status).toBe(415); expect(complete).not.toHaveBeenCalled(); });
  it("does not expose provider failures", async () => { complete.mockRejectedValue({ statusCode: 400, body: { code: "3051", secret: "provider detail" } }); const response = await POST(request(new File(["audio"], "clip.webm", { type: "audio/webm" }))); expect(response.status).toBe(502); expect(JSON.stringify(await response.json())).not.toContain("provider detail"); });
});
