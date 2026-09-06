import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const request = (file?: File) => {
  const data = new FormData();
  if (file) data.append("audio", file);
  data.append("language", "auto");
  return new Request("http://local/api/transcribe", { method: "POST", body: data });
};

describe("POST /api/transcribe", () => {
  beforeEach(() => { process.env.MISTRAL_API_KEY = "secret"; });
  afterEach(() => { delete process.env.MISTRAL_API_KEY; vi.restoreAllMocks(); });

  it("validates the Craig audio field and MIME types", async () => {
    expect((await POST(request())).status).toBe(400);
    expect((await POST(request(new File(["x"], "x.txt", { type: "text/plain" })))).status).toBe(415);
  });

  it("posts a manual multipart body with an exact content length", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const body = init?.body as Uint8Array;
      const text = Buffer.from(body).toString();
      expect(headers.get("authorization")).toBe("Bearer secret");
      expect(headers.get("content-type")).toMatch(/^multipart\/form-data; boundary=/);
      expect(Number(headers.get("content-length"))).toBe(body.byteLength);
      expect(text).toContain('name="model"\r\n\r\nvoxtral-mini-latest');
      expect(text).toContain('name="language"\r\n\r\nauto');
      expect(text).toContain('name="file"; filename="recording.webm"');
      return Response.json({ text: "Klarna transcript" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request(new File(["audio"], "clip.webm", { type: "audio/webm;codecs=opus" })));
    expect(await response.json()).toEqual({ text: "Klarna transcript" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.mistral.ai/v1/audio/transcriptions", expect.objectContaining({ method: "POST" }));
  });
});
