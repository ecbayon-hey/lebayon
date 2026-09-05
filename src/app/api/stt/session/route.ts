import { createRealtimeSession, RealtimeSessionError } from "@/lib/stt/mistral";
import { optionalSecret } from "@/lib/config/env";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    { available: Boolean(optionalSecret("MISTRAL_API_KEY")) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

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
      {
        error: provider?.status === undefined
          ? "Voice transcription is not configured on this deployment."
          : "Mistral could not create a voice session. Check the server logs and Mistral model access.",
      },
      { status: provider?.status === undefined ? 503 : 502 },
    );
  }
}
