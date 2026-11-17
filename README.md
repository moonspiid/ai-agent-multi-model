# AI Agent · Multi-Model

A single-file, zero-install web chat that talks to several AI providers from your browser. Open `index.html`, paste an API key, start chatting. No build step, no server, no dependency.

### ▶️ [Try it online](https://moonspiid.github.io/ai-agent-multi-model/)

No install needed: pick a provider, paste your own API key (it stays in your browser), and start chatting.

Created by [moonspiid](https://twitter.com/moonspiid) · © 2026 — 100% Free

## Features

- **Five providers, one interface** — OpenRouter, Google Gemini, Groq, Mistral and OVHcloud, all through the same OpenAI-compatible endpoint.
- **Automatic failover** — if the selected provider fails (invalid key, quota, outage, timeout), the app tries every other provider you have a key for and tells you which one answered.
- **Local conversation history** — the chat and your selected model are saved in the browser and restored when you come back.
- **Keys never leave the browser** — API keys are stored in `localStorage` and sent straight to the provider, never to a third-party server.
- **No markup injection** — messages are rendered with `textContent`, never `innerHTML`.
- **Keyboard friendly** — Enter sends, Shift+Enter makes a new line.
- **Clear errors** — HTTP status codes are translated into readable messages (rejected key, quota, retired model, outage, network block, 60 s timeout).

## Getting started

1. Open `index.html` in any modern browser (double-clicking the file works).
2. Click **Select Model** at the top right and pick a provider.
3. Follow the **Get a free API key →** link for that provider, paste the key and click **Save Key**.
4. Type a message and press Enter.

Keys are stored per browser, so you only paste them once. Use the **Delete key** button in the same menu to remove one.

### Providers and default models

| Provider | Default model (ID) | Key prefix |
| --- | --- | --- |
| OpenRouter | `meta-llama/llama-4-scout:free` | `sk-or-` |
| Google Gemini | `gemini-3.5-flash-lite` | `AIza`, `AQ.` |
| Groq | `openai/gpt-oss-120b` | `gsk_` |
| Mistral | `mistral-small-latest` | — |
| OVHcloud | `Meta-Llama-3_3-70B-Instruct` | — |

To use another model, edit the `models` array at the top of the `<script>` block. It is the single source of truth: the dropdown, the key forms and the failover chain are all generated from it.

## Notes

- Each request has a 60 second timeout.
- Replies are shown as plain text: Markdown is not rendered.
- Keys stored in `localStorage` are readable by any script running on the same page, so host the file on a trusted origin and avoid shared computers.
- Providers must allow browser requests (CORS). All five listed above do.

## License

Free to use and modify.
