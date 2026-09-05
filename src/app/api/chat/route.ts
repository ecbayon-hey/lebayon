import { runAgent } from "@/lib/ai/agent-loop";
import { optionalSecret } from "@/lib/config/env";
import type { StreamEvent } from "@/lib/stream/events";
import { chatRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

type ErrorWithProviderMetadata = Error & {
  status?: number;
  code?: string;
  request_id?: string;
};

function logChatFailure(error: unknown, requestId: string) {
  const providerError = error instanceof Error ? error as ErrorWithProviderMetadata : undefined;

  // Keep this deliberately limited to operational metadata: provider errors can
  // otherwise contain request content or credentials in their nested objects.
  console.error("Chat request failed", {
    requestId,
    errorName: providerError?.name ?? "UnknownError",
    upstreamStatus: providerError?.status,
    providerCode: providerError?.code,
    providerRequestId: providerError?.request_id,
    reason: providerError?.message ?? "unexpected_error",
  });
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const responseHeaders = { "X-Request-Id": requestId };
  const length = Number(req.headers.get("content-length") || 0);

  if (length > 250_000) {
    return Response.json({ error: "Request is too large", requestId }, { status: 413, headers: responseHeaders });
  }

  if (!optionalSecret("ANTHROPIC_API_KEY")) {
    console.error("Chat request rejected", { requestId, reason: "missing_anthropic_api_key" });
    return Response.json(
      {
        error: "Chat is not configured on this deployment. Add ANTHROPIC_API_KEY in Vercel and redeploy.",
        requestId,
      },
      { status: 503, headers: responseHeaders },
    );
  }

  let input;
  try {
    input = chatRequestSchema.parse(await req.json());
  } catch {
    console.warn("Chat request rejected", { requestId, reason: "invalid_request" });
    return Response.json({ error: "Invalid chat request", requestId }, { status: 400, headers: responseHeaders });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      const emit = (event: StreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      emit({ type: "conversation_started" });

      void runAgent(input, emit)
        .then(() => {
          emit({ type: "done" });
          controller.close();
        })
        .catch((error: unknown) => {
          logChatFailure(error, requestId);
          emit({
            type: "error",
            message: `The AI provider did not answer. Check the deployment logs, API key, model access, and provider quota. Reference: ${requestId}`,
            requestId,
          });
          emit({ type: "done" });
          controller.close();
        });
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      ...responseHeaders,
    },
  });
}
