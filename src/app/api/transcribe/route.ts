export const runtime = "nodejs";

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MISTRAL_TRANSCRIPTIONS_URL = "https://api.mistral.ai/v1/audio/transcriptions";
const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/webm;codecs=opus": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/ogg;codecs=opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

const encode = (value: string) => Buffer.from(value, "utf8");

export async function POST(req: Request) {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Voice transcription is not configured on this deployment." }, { status: 503 });

  let audioFile: File;
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) return Response.json({ error: "An audio file is required." }, { status: 400 });
    audioFile = audio;
  } catch {
    return Response.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  if (!audioFile.size) return Response.json({ error: "The recording is empty." }, { status: 400 });
  if (audioFile.size > MAX_AUDIO_BYTES) return Response.json({ error: "Audio file is too large." }, { status: 413 });
  const extension = EXTENSIONS[audioFile.type.toLowerCase()];
  if (!extension) return Response.json({ error: "Unsupported audio format." }, { status: 415 });

  const boundary = `----MistralBoundary${crypto.randomUUID().replaceAll("-", "")}`;
  const audio = Buffer.from(await audioFile.arrayBuffer());
  const fields = [
    encode(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nvoxtral-mini-latest\r\n`),
    encode(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nauto\r\n`),
    encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="recording.${extension}"\r\nContent-Type: ${audioFile.type}\r\n\r\n`),
    audio,
    encode(`\r\n--${boundary}--\r\n`),
  ];
  const body = Buffer.concat(fields);

  try {
    const response = await fetch(MISTRAL_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(body.byteLength),
      },
      body,
    });
    if (!response.ok) {
      console.error("Mistral transcription failed", { status: response.status, requestId: response.headers.get("x-request-id") });
      return Response.json({ error: "The recording could not be transcribed. Please try again." }, { status: 502 });
    }
    const result = await response.json() as { text?: unknown };
    if (typeof result.text !== "string") throw new Error("Malformed transcription response");
    return Response.json({ text: result.text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Mistral transcription request failed", { reason: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: "The recording could not be transcribed. Please try again." }, { status: 502 });
  }
}
