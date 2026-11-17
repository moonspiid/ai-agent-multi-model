# AI Agent · Multi-Model

![The chat answering a question, with the model menu closed](screenshot.png)

A single-file, zero-install web chat that talks to several AI providers from your browser. Open `index.html`, paste an API key, start chatting. No build step, no server, no dependency.

### ▶️ Try it online

[GitHub Pages](https://moonspiid.github.io/ai-agent-multi-model/) · [Netlify](https://ai-agent-multi-model.netlify.app/)

No install needed: pick a provider, paste your own API key (it stays in your browser), and start chatting.

Created by [moonspiid](https://twitter.com/moonspiid) · © 2026 — 100% Free

## Features

- **Five providers, one interface** — OpenRouter, Google Gemini, Groq, Cohere and UnoRouter (DeepSeek V4.1 Flash), all through one OpenAI-compatible request format. Each one has a free way in that renews, so no single provider running dry stops the chat.
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
| OpenRouter | `nvidia/nemotron-3.5-lightning:free` | `sk-or-` |
| Google Gemini | `gemini-3.5-flash-lite` | `AIza`, `AQ.` |
| Groq | `openai/gpt-oss-120b` | `gsk_` |
| UnoRouter | `deepseek-v4.1-flash:free` | — |
| Cohere | `command-a-plus-05-2026` | — |

To use another model, edit the `models` array at the top of the `<script>` block. It is the single source of truth: the dropdown, the key forms and the failover chain are all generated from it.

Each entry is also the description of how to talk to that provider:

| Field | Meaning |
| --- | --- |
| `url`, `model` | Where the request goes and which model ID it asks for |
| `keyName` | `localStorage` slot holding that provider's key |
| `keyUrl`, `placeholder`, `prefixes` | Link to get a key, input hint, and the prefixes the key is checked against before saving |
| `style`, `maxTokens` | Only needed for a provider that speaks Anthropic's Messages API instead of the OpenAI format (`x-api-key` header, `anthropic-version`, `max_tokens`, reply in `content[]`). No default provider uses them. |

## Notes

- Each request has a 60 second timeout.
- Replies are shown as plain text: Markdown is not rendered.
- Keys stored in `localStorage` are readable by any script running on the same page, so host the file on a trusted origin and avoid shared computers.
- Providers must allow browser requests (CORS). All five listed above do.
- What you get for free: OpenRouter's free models, the Gemini API free tier, Groq's free plan, Cohere trial keys (1,000 calls a month, 20 requests a minute, renewed monthly) and UnoRouter's `:free` models (no card, roughly one request per minute per model). None of them needs a prepaid balance that can be exhausted for good.
- Every provider above was checked to allow browser requests with the headers the app sends. Some otherwise free providers (Z.ai, Cloudflare Workers AI, NVIDIA NIM, Vercel AI Gateway) block browser calls, so they are deliberately not in the list. AIHubMix passes CORS but caps accounts that never recharged at 10 free requests in total, so it was dropped too.

## License

Free to use and modify.
