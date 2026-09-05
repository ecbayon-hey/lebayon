import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/agent-loop", () => ({ runAgent: vi.fn() }));

import { runAgent } from "@/lib/ai/agent-loop";
import { POST } from "./route";

const mockedRunAgent = vi.mocked(runAgent);
const request = (body = { messages: [{ role: "user", content: "Hello" }] }) => new Request(
  "http://localhost/api/chat",
  { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
);

describe("POST /api/chat", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "provider-secret";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("returns a traceable 503 and logs a safe reason when chat is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.requestId).toBe(response.headers.get("x-request-id"));
    expect(JSON.stringify(body)).not.toContain("provider-secret");
    expect(console.error).toHaveBeenCalledWith("Chat request rejected", {
      requestId: body.requestId,
      reason: "missing_anthropic_api_key",
    });
  });

  it("correlates a streamed provider failure with sanitized server metadata", async () => {
    const providerError = Object.assign(new Error("model is unavailable"), {
      status: 429,
      code: "rate_limit_error",
      request_id: "provider-request-id",
      secret: "must-not-be-logged",
    });
    mockedRunAgent.mockRejectedValue(providerError);

    const response = await POST(request());
    const responseText = await response.text();
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(200);
    expect(responseText).toContain(`Reference: ${requestId}`);
    expect(responseText).toContain(`"requestId":"${requestId}"`);
    expect(console.error).toHaveBeenCalledWith("Chat request failed", {
      requestId,
      errorName: "Error",
      upstreamStatus: 429,
      providerCode: "rate_limit_error",
      providerRequestId: "provider-request-id",
      reason: "model is unavailable",
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("must-not-be-logged");
  });
});
