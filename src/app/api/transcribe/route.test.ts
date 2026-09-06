import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_AUDIO_BYTES, POST } from "./route";

const request = (file?: File, language = "auto") => {
  const data = new FormData();
  if (file) data.append("audio", file);
  data.append("language", language);
  return new Request("http://local/api/transcribe", { method: "POST", body: data });
};

const audioFile = (type: string, contents: BlobPart = "audio-bytes") =>
  new File([contents], "clip", { type });

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    process.env.MISTRAL_API_KEY = "secret";
  });

  afterEach(() => {
    delete process.env.MISTRAL_API_KEY;
    vi.restoreAllMocks();
  });

  it.each([
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
  ])("accepts %s without MIME rejection", async (mimeType) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ text: "Transcript" })));

    const response = await POST(request(audioFile(mimeType)));

    expect(response.status).toBe(200);
  });

  it("rejects a missing or empty audio file", async () => {
    expect((await POST(request())).status).toBe(400);
    expect((await POST(request(audioFile("audio/webm", "")))).status).toBe(400);
  });

  it("rejects audio larger than 25 MB", async () => {
    const oversized = audioFile("audio/webm", new Uint8Array(MAX_AUDIO_BYTES + 1));

    expect((await POST(request(oversized))).status).toBe(413);
  });

  it("posts Craig's manual multipart body with exact content length and audio bytes", async () => {
    const bytes = new Uint8Array([0, 17, 34, 51, 68, 255]);
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const body = init?.body as Uint8Array;
      const multipart = Buffer.from(body);
      const text = multipart.toString("latin1");

      expect(headers.get("authorization")).toBe("Bearer secret");
      expect(headers.get("content-type")).toMatch(/^multipart\/form-data; boundary=/);
      expect(Number(headers.get("content-length"))).toBe(body.byteLength);
      expect(text).toContain('name="model"\r\n\r\nvoxtral-mini-latest');
      expect(text).toContain('name="file"; filename="recording.webm"');
      expect(multipart.includes(Buffer.from(bytes))).toBe(true);
      expect(text).not.toContain('name="language"');
      return Response.json({ text: "Transcript" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(audioFile("audio/webm;codecs=opus", bytes)));

    expect(await response.json()).toEqual({ text: "Transcript" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mistral.ai/v1/audio/transcriptions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("forwards an explicit language to Mistral", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const multipart = Buffer.from(init?.body as Uint8Array).toString();
      expect(multipart).toContain('name="language"\r\n\r\nen');
      return Response.json({ text: "Transcript" });
    });
    vi.stubGlobal("fetch", fetchMock);

    expect((await POST(request(audioFile("audio/mp4"), "en"))).status).toBe(200);
  });
});
