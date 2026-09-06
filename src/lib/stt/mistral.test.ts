import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const complete = vi.fn().mockResolvedValue({ text: "ok" });
vi.mock("@mistralai/mistralai", () => ({ Mistral: class { audio = { transcriptions: { complete } }; } }));
import { safeMistralError, transcribeAudio } from "./mistral";

describe("Mistral standard transcription", () => {
  beforeEach(() => { process.env.MISTRAL_API_KEY = "test-key"; complete.mockClear(); });
  afterEach(() => { delete process.env.MISTRAL_API_KEY; });

  it("isolates the same file without and with context bias", async () => {
    const file = new File(["valid audio fixture"], "recording.wav", { type: "audio/wav" });
    await transcribeAudio(file, { useContextBias: false });
    await transcribeAudio(file, { useContextBias: true });
    expect(complete.mock.calls[0][0]).not.toHaveProperty("contextBias");
    expect(complete.mock.calls[1][0].contextBias).toContain("authorizePayment");
    expect(complete.mock.calls[0][0]).toMatchObject({ model: "voxtral-mini-latest", file, language: "en" });
  });

  it("extracts safe SDKError fields from a serialized provider body", () => {
    const metadata = safeMistralError({ statusCode: 400, body: JSON.stringify({ message: "Invalid file", code: "invalid_request", type: "validation_error", param: "file" }), rawResponse: { headers: new Headers({ "x-request-id": "req-123" }) } });
    expect(metadata).toEqual({ status: 400, message: "Invalid file", code: "invalid_request", type: "validation_error", param: "file", requestId: "req-123" });
  });
});
