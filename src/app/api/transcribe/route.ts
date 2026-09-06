import { transcribeAudio, TranscriptionError } from "@/lib/stt/mistral";

export const runtime = "nodejs";

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/webm", "audio/ogg", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac",
]);

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_AUDIO_BYTES + 1024 * 32) return Response.json({ error: "Audio file is too large." }, { status: 413 });

  let file: File;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (!(candidate instanceof File)) return Response.json({ error: "An audio file is required." }, { status: 400 });
    file = candidate;
  } catch {
    return Response.json({ error: "Invalid multipart form data." }, { status: 400 });
  }
  const mime = file.type.toLowerCase().split(";")[0];
  if (!SUPPORTED_AUDIO_TYPES.has(mime)) return Response.json({ error: "Unsupported audio format." }, { status: 415 });
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(file.name)) return Response.json({ error: "Invalid audio filename." }, { status: 400 });
  if (!file.size) return Response.json({ error: "The recording is empty." }, { status: 400 });
  if (file.size > MAX_AUDIO_BYTES) return Response.json({ error: "Audio file is too large." }, { status: 413 });

  try {
    return Response.json({ text: await transcribeAudio(file) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const provider = error instanceof TranscriptionError ? error : undefined;
    console.error("STT failure", {
      uploadedMime: mime,
      bytes: file.size,
      model: process.env.MISTRAL_STT_MODEL || "voxtral-mini-latest",
      upstreamStatus: provider?.metadata.status,
      providerCode: provider?.metadata.code,
      providerParam: provider?.metadata.param,
      providerType: provider?.metadata.type,
    });
    return Response.json(
      { error: provider?.status === undefined ? "Voice transcription is not configured on this deployment." : "The recording could not be transcribed. Please try again." },
      { status: provider?.status === undefined ? 503 : 502 },
    );
  }
}
