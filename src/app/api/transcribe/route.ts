export const runtime = "nodejs";
export const maxDuration = 120;

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const MISTRAL_TRANSCRIPTIONS_URL = "https://api.mistral.ai/v1/audio/transcriptions";

export async function POST(req: Request) {
  const formData = await req.formData();
  const audioFile = formData.get("audio") as File | null;
  const language = formData.get("language") as string | null;

  if (!audioFile) {
    return Response.json({ error: "No audio file provided" }, { status: 400 });
  }

  if (audioFile.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "Audio file too large (max 25MB)" }, { status: 413 });
  }

  if (audioFile.size === 0) {
    return Response.json({ error: "Audio file is empty" }, { status: 400 });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Transcription service not configured" }, { status: 500 });
  }

  const mimeType = audioFile.type || "audio/webm";

  const extMap: Record<string, string> = {
    "audio/webm": "webm",
    "audio/webm;codecs=opus": "webm",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/ogg;codecs=opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
  };

  const ext = extMap[mimeType] || "webm";
  const audioBuffer = await audioFile.arrayBuffer();
  const boundary = `----MistralBoundary${Date.now().toString(16)}`;
  const filename = `recording.${ext}`;
  const encoder = new TextEncoder();

  const modelPart = encoder.encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `voxtral-mini-latest\r\n`,
  );
  const fileHeader = encoder.encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  );
  const languagePart =
    language && language !== "auto"
      ? encoder.encode(
          `\r\n--${boundary}\r\n` +
            `Content-Disposition: form-data; name="language"\r\n\r\n` +
            `${language}`,
        )
      : new Uint8Array(0);
  const closing = encoder.encode(`\r\n--${boundary}--\r\n`);

  const totalLength =
    modelPart.byteLength +
    fileHeader.byteLength +
    audioBuffer.byteLength +
    languagePart.byteLength +
    closing.byteLength;
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of [modelPart, fileHeader, new Uint8Array(audioBuffer), languagePart, closing]) {
    body.set(part, offset);
    offset += part.byteLength;
  }

  try {
    const mistralRes = await fetch(MISTRAL_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": totalLength.toString(),
      },
      body,
    });

    if (!mistralRes.ok) {
      const errText = await mistralRes.text();
      console.error("Mistral API error:", mistralRes.status, errText);
      return Response.json(
        { error: `Transcription service error (${mistralRes.status})` },
        { status: 502 },
      );
    }

    const result = (await mistralRes.json()) as { text?: string };
    return Response.json({ text: result.text || "" });
  } catch (error) {
    console.error("Transcription error:", error);
    return Response.json({ error: "Failed to transcribe audio" }, { status: 500 });
  }
}
