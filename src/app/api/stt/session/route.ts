import { createRealtimeSession, RealtimeSessionError } from "@/lib/stt/mistral";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 1024) {
    return Response.json({ error: "Invalid request" }, { status: 413 });
  }

  try {
    return Response.json(await createRealtimeSession(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const provider = error instanceof RealtimeSessionError ? error : undefined;
    // Log only operational metadata. In particular, never log the provider body,
    // request headers, master API key, or ephemeral browser credential.
    console.error("STT session failed", {
      upstreamStatus: provider?.status,
      providerCode: provider?.providerCode,
      reason: provider?.message ?? "unexpected_error",
    });
    return Response.json(
      { error: "Voice transcription is unavailable right now." },
      { status: provider?.status === undefined ? 503 : 502 },
    );
  }
}
