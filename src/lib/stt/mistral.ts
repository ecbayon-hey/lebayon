import "server-only";

import { optionalSecret, optionalValue } from "@/lib/config/env";

export const DEFAULT_STT_MODEL = "voxtral-mini-latest";
export const MISTRAL_TRANSCRIPTIONS_ENDPOINT = "https://api.mistral.ai/v1/audio/transcriptions";

export const KLARNA_CONTEXT_BIAS = [
  "Klarna", "Klarna Network", "KN", "KNST", "Klarna Network Session Token",
  "Payment Presentation", "Payment Authorization", "authorizePayment", "Payment Request",
  "Payment Transaction", "Network Session", "Acquiring Partner", "Partner Account", "mTLS",
  "Web SDK", "onWidgetCancel", "onWidgetComplete", "onAbort", "SIWK",
  "Sign in with Klarna", "OSM", "On-site Messaging",
];

export class TranscriptionError extends Error {
  constructor(message: string, readonly status?: number, readonly providerCode?: string) {
    super(message);
    this.name = "TranscriptionError";
  }
}

export async function transcribeAudio(file: File) {
  const key = optionalSecret("MISTRAL_API_KEY");
  if (!key) throw new TranscriptionError("MISTRAL_API_KEY is not configured");

  const body = new FormData();
  body.append("model", optionalValue("MISTRAL_STT_MODEL", DEFAULT_STT_MODEL));
  body.append("file", file, file.name);
  // Mistral's multipart endpoint accepts context_bias as a JSON-encoded string array.
  body.append("context_bias", JSON.stringify(KLARNA_CONTEXT_BIAS));

  const response = await fetch(MISTRAL_TRANSCRIPTIONS_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    let code: string | undefined;
    try {
      const json = await response.json() as { error?: { code?: unknown }; code?: unknown };
      const raw = json.error?.code ?? json.code;
      if (typeof raw === "string" && /^[\w.-]{1,80}$/.test(raw)) code = raw;
    } catch { /* Provider response bodies are intentionally not exposed. */ }
    throw new TranscriptionError("Mistral rejected the transcription", response.status, code);
  }
  const json = await response.json() as { text?: unknown };
  if (typeof json.text !== "string") throw new TranscriptionError("Mistral returned a malformed transcription", response.status, "malformed_response");
  return json.text.trim();
}
