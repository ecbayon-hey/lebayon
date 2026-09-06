import "server-only";
import { Mistral } from "@mistralai/mistralai";
import { optionalSecret, optionalValue } from "@/lib/config/env";

export const DEFAULT_STT_MODEL = "voxtral-mini-latest";
export const KLARNA_CONTEXT_BIAS = [
  "Klarna", "Klarna Network", "KN", "KNST", "Klarna Network Session Token",
  "Network Session", "Payment Presentation", "Payment Authorization", "authorizePayment",
  "Payment Request", "Payment Transaction", "Acquiring Partner", "Partner Account", "mTLS",
  "Web SDK", "onWidgetCancel", "onWidgetComplete", "onWidgetError", "onAbort", "SIWK",
  "Sign in with Klarna", "OSM", "On-site Messaging",
];

type SafeProviderMetadata = { status?: number; code?: string; param?: string; type?: string };
export class TranscriptionError extends Error {
  constructor(message: string, readonly metadata: SafeProviderMetadata = {}) { super(message); this.name = "TranscriptionError"; }
  get status() { return this.metadata.status; }
}

const safeString = (value: unknown) => typeof value === "string" && /^[\w.-]{1,80}$/.test(value) ? value : undefined;

export async function transcribeAudio(file: File) {
  const key = optionalSecret("MISTRAL_API_KEY");
  if (!key) throw new TranscriptionError("MISTRAL_API_KEY is not configured");
  const client = new Mistral({ apiKey: key });
  try {
    const response = await client.audio.transcriptions.complete({
      model: optionalValue("MISTRAL_STT_MODEL", DEFAULT_STT_MODEL),
      file,
      contextBias: KLARNA_CONTEXT_BIAS,
    });
    if (typeof response.text !== "string") throw new TranscriptionError("Mistral returned a malformed transcription", { code: "malformed_response" });
    return response.text.trim();
  } catch (error) {
    if (error instanceof TranscriptionError) throw error;
    const value = error as { statusCode?: unknown; status?: unknown; body?: { object?: string; code?: unknown; param?: unknown; type?: unknown } };
    const status = typeof value.statusCode === "number" ? value.statusCode : typeof value.status === "number" ? value.status : undefined;
    throw new TranscriptionError("Mistral rejected the transcription", {
      status,
      code: safeString(value.body?.code),
      param: safeString(value.body?.param),
      type: safeString(value.body?.type),
    });
  }
}
