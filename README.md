# LeBayon

LeBayon is a focused, session-only AI companion for Klarna Network Solution & Delivery colleagues. It combines Anthropic orchestration with an official-document-first grounding policy, live web research, inline images, diagrams, charts, and Mistral realtime transcription—inside a tactile e-ink/blueprint chat interface.

## Architecture

- **Next.js App Router + React + TypeScript** deploy directly to Vercel.
- **Anthropic Messages API** runs a server-side tool loop (maximum six iterations by default) and streams typed SSE events to the browser.
- **Klarna docs** use a generated MiniSearch corpus for discovery, followed by a cached server-side fetch of matching canonical pages whenever possible. Official docs outrank all other sources.
- **Perplexity** provides wider/current web research; **OpenAI GPT Image** provides inline generated images.
- **Mistral Voxtral Realtime** uses an ephemeral credential minted by `/api/stt/session`; the master key never reaches browser code.
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
| `MISTRAL_API_KEY` | Server-only Mistral key used to mint short-lived browser credentials (required for voice) |
| `MISTRAL_STT_MODEL` | Must be `voxtral-mini-transcribe-realtime-2602` (the only model supported by this client) |
| `KN_DOCS_REVALIDATE_SECONDS` | Canonical documentation fetch cache (default 3600s) |
| `MAX_TOOL_ITERATIONS` | Agent-loop safety cap (hard capped at six) |

No provider master key is public. Never prefix one with `NEXT_PUBLIC_`.

For Vercel, add `MISTRAL_API_KEY` and
`MISTRAL_STT_MODEL=voxtral-mini-transcribe-realtime-2602` in **Project Settings →
Environment Variables** for each environment where voice input is enabled, then
redeploy. Neither variable is a `NEXT_PUBLIC_` variable. The application negotiates
WebM/Opus audio and is intentionally pinned to Voxtral Mini Transcribe Realtime
`2602`; changing the model without updating the realtime wire contract is rejected.

## Klarna documentation corpus

The committed `knowledge/generated/klarna-docs.json` makes development usable without a startup crawl. Regenerate it explicitly:

```bash
npm run sync:kn-docs
```

The crawler starts at all seven canonical Klarna Network roots, follows only `docs.klarna.com/klarna-network-distribution/` descendants, strips navigation, preserves headings and canonical URLs, and creates semantic text chunks. Set `KN_DOCS_MAX_PAGES` to bound a development crawl. Review the generated diff before committing; documentation structure can change.

Add practical internal context to `knowledge/eddy-notes.md`. Date and link notes where possible. Eddy notes are secondary context and never override current public API contracts.

## Deployment diagnostics

Before deploying, validate the exact environment visible to the application:

```bash
npm run check:env
```

The command never prints secret values. Chat requires `ANTHROPIC_API_KEY`; voice, web
research, and image generation remain optional and report their missing provider key.
After changing a Vercel environment variable, redeploy: environment changes do not alter
already-built deployments. A `503` from `/api/chat` or `/api/stt/session` now explicitly
means the corresponding key is absent; a `502` from the voice route means Mistral rejected
the session request (check model access, quota, and the sanitized Vercel log metadata).

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
