import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const request = () => new Request("http://localhost/api/stt/session", { method: "POST" });

describe("POST /api/stt/session", () => {
  beforeEach(() => {
    process.env.MISTRAL_API_KEY = "master-secret";
    process.env.MISTRAL_STT_MODEL = "voxtral-mini-transcribe-realtime-2602";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.MISTRAL_API_KEY;
    delete process.env.MISTRAL_STT_MODEL;
  });

  it("returns 503 without server credentials", async () => {
    delete process.env.MISTRAL_API_KEY;
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Voice transcription is unavailable right now." });
  });

  it("hides provider rejection details and logs sanitized metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "capacity_exceeded", message: "contains secret" } }),
      { status: 429 },
    )));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    expect(console.error).toHaveBeenCalledWith("STT session failed", expect.objectContaining({
      upstreamStatus: 429,
      providerCode: "capacity_exceeded",
    }));
  });

  it("rejects malformed provider responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ token: "wrong-contract" })));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(console.error).toHaveBeenCalledWith("STT session failed", expect.objectContaining({
      providerCode: "malformed_response",
    }));
  });

  it("returns only the documented browser session configuration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      client_secret: { value: "ephemeral", expires_at: 2_000_000_000 },
      ignored_provider_field: "do-not-forward",
    })));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      credential: "ephemeral",
      endpoint: "wss://api.mistral.ai/v1/realtime?model=voxtral-mini-transcribe-realtime-2602",
      expiresAt: 2_000_000_000,
      protocols: ["realtime", "mistral-insecure-api-key.ephemeral"],
      audioFormat: "audio/webm;codecs=opus",
    });
  });
});
