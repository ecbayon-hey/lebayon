# LeBayon

LeBayon is a general-purpose AI assistant with specialist expertise in Klarna Network Solution & Delivery. It combines Anthropic orchestration with an official-document-first grounding policy, live web research, inline images, diagrams, charts, and Mistral transcription—inside a tactile e-ink/blueprint chat interface.

## Architecture

- **Next.js App Router + React + TypeScript** deploy directly to Vercel.
- **Anthropic Messages API** runs a normal server-side tool loop and streams only the final answer to the browser.
- **Klarna docs** are read live, one official page at a time, through `read_klarna_docs`. Claude chooses the page and may follow official links; there is no router, index, corpus, or snapshot.
- **Perplexity** provides wider/current web research; **OpenAI GPT Image** provides inline generated images.
- **Mistral Voxtral** transcribes completed MediaRecorder audio through the server-only `/api/transcribe` route. Web Audio drives the live waveform independently, and transcripts remain editable until Send is pressed.
- Mermaid and validated Recharts artifacts render inline. Heavy Mermaid code is dynamically loaded.
- Messages and rolling summaries live in React memory only. Only theme preference uses `localStorage`.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add the provider keys you intend to use. `ANTHROPIC_API_KEY` is required for chat; individual tools return a controlled error when their provider is not configured. Model names are environment-configurable because provider availability changes.

## Environment

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Reasoning, orchestration, streaming, and compaction |
| `PERPLEXITY_API_KEY` | Wider web research |
| `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL` | Image generation |
| `MISTRAL_API_KEY` | Server-only Mistral key used for standard audio transcription |
| `MAX_TOOL_ITERATIONS` | Research rounds allowed before a mandatory final answer (defaults to 10, hard capped at 20) |

No provider master key is public. Never prefix one with `NEXT_PUBLIC_`.

For Vercel, add `MISTRAL_API_KEY` in **Project Settings → Environment Variables**, then redeploy. It is not a `NEXT_PUBLIC_` variable. The browser uses MediaRecorder with WebM/Opus, WebM, then MP4 fallback order. The completed recording and `language=auto` are uploaded, and the route sends a manual multipart request with an exact Content-Length to `voxtral-mini-latest`.

Add practical internal context to `knowledge/eddy-notes.md`. Date and link notes where possible. Eddy notes are secondary context and never override current public API contracts.

## Deployment diagnostics

Before deploying, validate the exact environment visible to the application:

```bash
npm run check:env
```

The command never prints secret values. Chat requires `ANTHROPIC_API_KEY`; voice, web
research, and image generation remain optional and report their missing provider key.
After changing a Vercel environment variable, redeploy: environment changes do not alter
already-built deployments. A `503` from `/api/chat` or `/api/transcribe` now explicitly
means the corresponding key is absent; a `502` from the voice route means Mistral rejected
the audio request (check model access, quota, and the sanitized Vercel log metadata).
Chat failures are logged by the server function in **Vercel → Logs**, not only in the
browser console. Every chat response includes an `X-Request-Id`; provider failures show
the same reference in the chat, browser console, and sanitized server log so the three
views can be correlated without logging prompts or API keys.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Vercel, privacy, and access

Import this repository into Vercel and configure the same environment variables. Route handlers need no persistent server and use server-only credentials. Enable **Web Analytics** for the project in the Vercel dashboard as well; installing the application package does not enable the project setting. After deployment, visit multiple routes or reload the application, then confirm that page views appear in the Vercel Analytics dashboard. Browser content blockers can block analytics requests, so disable them for the site if they prevent local verification. Chats are not written to a database, filesystem, cookies, or browser storage; refreshing or **New chat** clears the thread. Requests still travel to the selected AI providers, so do not imply provider-side zero retention without separately confirmed agreements.

The app emits `noindex` metadata and a disallowing `robots.txt`, but obscurity is not access control. Enable Vercel Deployment Protection, an identity-aware proxy, or another organizational access layer before exposing an internal deployment.
