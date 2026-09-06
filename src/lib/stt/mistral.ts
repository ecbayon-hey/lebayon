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

type SafeProviderMetadata = { status?: number; message?: string; code?: string; param?: string; type?: string; requestId?: string };
export class TranscriptionError extends Error {
  constructor(message: string, readonly metadata: SafeProviderMetadata = {}) { super(message); this.name = "TranscriptionError"; }
  get status() { return this.metadata.status; }
}

const safeString = (value: unknown) => typeof value === "string" && /^[\w.-]{1,80}$/.test(value) ? value : undefined;
const safeMessage = (value: unknown) => typeof value === "string"
  ? value.replace(/(?:bearer\s+)?[a-z0-9_-]{24,}/gi, "[redacted]").replace(/[\r\n]+/g, " ").slice(0, 300)
  : undefined;

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object") return body as Record<string, unknown>;
  if (typeof body === "string") { try { const parsed: unknown = JSON.parse(body); return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}; } catch { return {}; } }
  return {};
}

export function safeMistralError(error: unknown): SafeProviderMetadata {
  const value = error as { statusCode?: unknown; status?: unknown; body?: unknown; response?: { status?: unknown; headers?: Headers }; rawResponse?: { status?: unknown; headers?: Headers }; requestId?: unknown };
  const body = parseBody(value?.body);
  const nested = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : body;
  const response = value?.rawResponse ?? value?.response;
  const status = [value?.statusCode, value?.status, response?.status].find((item) => typeof item === "number") as number | undefined;
  return {
    status,
    message: safeMessage(nested.message),
    code: safeString(nested.code), param: safeString(nested.param), type: safeString(nested.type),
    requestId: safeString(value?.requestId) ?? safeString(response?.headers?.get("x-request-id")) ?? safeString(response?.headers?.get("request-id")),
  };
}

export async function transcribeAudio(file: File, options: { useContextBias?: boolean } = {}) {
  const key = optionalSecret("MISTRAL_API_KEY");
  if (!key) throw new TranscriptionError("MISTRAL_API_KEY is not configured");
  const client = new Mistral({ apiKey: key });
  try {
    const response = await client.audio.transcriptions.complete({
      model: optionalValue("MISTRAL_STT_MODEL", DEFAULT_STT_MODEL),
      file,
      language: "en",
      ...(options.useContextBias === false ? {} : { contextBias: KLARNA_CONTEXT_BIAS }),
    });
    if (typeof response.text !== "string") throw new TranscriptionError("Mistral returned a malformed transcription", { code: "malformed_response" });
    return response.text.trim();
  } catch (error) {
    if (error instanceof TranscriptionError) throw error;
    throw new TranscriptionError("Mistral rejected the transcription", safeMistralError(error));
  }
}
