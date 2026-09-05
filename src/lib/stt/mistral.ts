import "server-only";

import { z } from "zod";
import { optionalSecret, optionalValue } from "@/lib/config/env";

export const VOXTRAL_REALTIME_MODEL = "voxtral-mini-transcribe-realtime-2602";
export const VOXTRAL_REALTIME_ENDPOINT =
  `wss://api.mistral.ai/v1/realtime?model=${VOXTRAL_REALTIME_MODEL}`;

const SESSION_ENDPOINT = "https://api.mistral.ai/v1/realtime/transcription_sessions";

// This is the response shape of POST /v1/realtime/transcription_sessions. Do not
// broaden it with token/url fallbacks: doing so can accidentally expose fields from
// a different Mistral API response.
const providerSessionSchema = z.object({
  client_secret: z.object({
    value: z.string().min(1),
    expires_at: z.number().int().positive(),
  }),
});

export class RealtimeSessionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = "RealtimeSessionError";
  }
}

function sanitizedCode(value: unknown) {
  if (typeof value !== "string") return undefined;
  return /^[a-zA-Z0-9_.-]{1,80}$/.test(value) ? value : undefined;
}

export async function createRealtimeSession() {
  const key = optionalSecret("MISTRAL_API_KEY");
  if (!key) throw new RealtimeSessionError("MISTRAL_API_KEY is not configured");

  const model = optionalValue("MISTRAL_STT_MODEL", VOXTRAL_REALTIME_MODEL);
  if (model !== VOXTRAL_REALTIME_MODEL) {
    throw new RealtimeSessionError(`Unsupported MISTRAL_STT_MODEL: ${model}`);
  }

  const response = await fetch(SESSION_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    let code: string | undefined;
    try {
      const body = (await response.json()) as { error?: { code?: unknown }; code?: unknown };
      code = sanitizedCode(body.error?.code ?? body.code);
    } catch {
      // Provider bodies are deliberately not copied into our error or response.
    }
    throw new RealtimeSessionError("Mistral rejected the realtime session", response.status, code);
  }

  let parsed: z.infer<typeof providerSessionSchema>;
  try {
    parsed = providerSessionSchema.parse(await response.json());
  } catch {
    throw new RealtimeSessionError("Mistral returned a malformed realtime session", response.status, "malformed_response");
  }

  return {
    credential: parsed.client_secret.value,
    endpoint: VOXTRAL_REALTIME_ENDPOINT,
    expiresAt: parsed.client_secret.expires_at,
    protocols: ["realtime", `mistral-insecure-api-key.${parsed.client_secret.value}`],
    audioFormat: "audio/webm;codecs=opus" as const,
  };
}
