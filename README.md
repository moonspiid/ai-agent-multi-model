# AI Agent · Multi-Model

<p>
  <img alt="ai chat, multi-model" src="https://img.shields.io/badge/ai--chat-multi--model-ff2d8f?labelColor=30363d">
  <img alt="5 free providers" src="https://img.shields.io/badge/providers-5%20free-2ea043?labelColor=30363d">
  <img alt="automatic failover" src="https://img.shields.io/badge/failover-automatic-1f6feb?labelColor=30363d">
  <img alt="no build step" src="https://img.shields.io/badge/build-none-8957e5?labelColor=30363d">
  <br>
  <img alt="installable PWA" src="https://img.shields.io/badge/pwa-installable-ea7a15?labelColor=30363d">
  <img alt="keys stored locally" src="https://img.shields.io/badge/keys-stored%20locally-3fb950?labelColor=30363d">
  <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-2ea043?labelColor=30363d">
  <img alt="price, free" src="https://img.shields.io/badge/price-free-2ea043?labelColor=30363d">
</p>

**One web chat, five free AI providers, automatic failover.** Open it, paste your own API key, start typing. If the provider you picked runs dry, the next one you have a key for answers instead.

<h3 align="center">
  <a href="https://moonspiid.github.io/ai-agent-multi-model/">▶️ Open the app</a>
</h3>

<p align="center">
  No account, no install, no build step, no server, no dependency — one HTML file that runs in the browser.
  <br>
  Works the same on a phone and on a desktop, and installs as an app.
</p>

## Contents

- [Why](#why)
- [Features](#features)
- [Quick start](#quick-start)
- [Install it as an app](#install-it-as-an-app)
- [Providers](#providers)
- [How it works](#how-it-works)
- [Good to know](#good-to-know)
- [Support this project](#support-this-project)
- [License](#license)

## Why

Every free AI tier runs out eventually: a key gets rejected, a quota resets, a model is retired. Instead of juggling five tabs, this app keeps one conversation and quietly moves it to whichever provider still has room. You keep one interface; the failover bookkeeping is done for you.

## Features

- **Five providers, one interface** — OpenRouter, Google Gemini, Groq, Cohere and UnoRouter (GPT-OSS 120B), all through one OpenAI-compatible request format. Each has a free way in that renews, so no single provider running dry stops the chat.
- **Automatic failover** — if the selected provider fails (invalid key, quota, outage, timeout), the app tries every other provider you have a key for and tells you which one answered.
- **Local conversation history** — the open chat is saved in the browser and restored when you come back. The 🕘 button lists your last 10 conversations, titled by their first message; click one to reload it.
- **Keys never leave the browser** — API keys are stored in `localStorage` and sent straight to the provider, never to a third-party server.
- **No markup injection** — messages are rendered with `textContent`, never `innerHTML`.
- **Image attachments** — the **+** button next to the message box attaches up to 4 pictures per message (shrunk to 1024 px before sending); they reach the model as images, so pick a provider and model that can see them.
- **Installable app** — a web app manifest, icons and a service worker let Chrome install it as a standalone app; the shell is cached, so the interface opens even offline.
- **Keyboard friendly** — Enter sends, Shift+Enter makes a new line.
- **Clear errors** — HTTP status codes are translated into readable messages (rejected key, quota, retired model, outage, network block, 60 s timeout).

## Quick start

1. Open **[the online version](https://moonspiid.github.io/ai-agent-multi-model/)**, or `index.html` from this repository in any modern browser (double-clicking the file works).
2. Tap **Select Model** at the top right and pick a provider.
3. Follow the **Get a free API key →** link, paste the key and tap **Save Key**. Then type a message.

Keys are stored per browser, so you paste them once. The **Delete key** button in the same menu removes one.

## Install it as an app

- **Android / Chrome** — ⋮ menu → *Install app* (or the install icon in the address bar), or *Add to home screen*.
- **iPhone / Safari** — Share → *Add to Home Screen*.
- **Desktop Chrome / Edge** — the install icon in the address bar.

It then runs in its own window with its own icon, without browser chrome. Messages need a connection; the interface itself opens offline.

## Providers

| Provider | Default model (ID) | Key prefix |
| --- | --- | --- |
| OpenRouter | `nvidia/nemotron-3.5-lightning:free` | `sk-or-` |
| Google Gemini | `gemini-3.5-flash-lite` | `AIza`, `AQ.` |
| Groq | `openai/gpt-oss-120b` | `gsk_` |
| UnoRouter | `gpt-oss-120b:free` | — |
| Cohere | `command-a-plus-05-2026` | — |

To use another model, edit the `models` array at the top of the `<script>` block. It is the single source of truth: the dropdown, the key forms and the failover chain are all generated from it.

| Field | Meaning |
| --- | --- |
| `url`, `model` | Where the request goes and which model ID it asks for |
| `keyName` | `localStorage` slot holding that provider's key |
| `keyUrl`, `placeholder`, `prefixes` | Link to get a key, input hint, and the prefixes the key is checked against before saving |
| `style`, `maxTokens` | Only needed for a provider that speaks Anthropic's Messages API instead of the OpenAI format (`x-api-key` header, `anthropic-version`, `max_tokens`, reply in `content[]`). No default provider uses them. |

## How it works

`index.html` is the whole app: markup, CSS and one `<script>` block. There is no framework and nothing to compile.

- The `models` array describes each provider (endpoint, model ID, storage slot, key format).
- Sending a message builds one request in the OpenAI chat format and posts it to the selected provider.
- On an error, the same request is replayed against the next provider that has a saved key, and a small notice in the chat says which one answered.

Everything else is browser APIs: `fetch`, `localStorage`, and a service worker for the installable shell.

## Good to know

- Each request has a 60 second timeout.
- Replies are shown as plain text: Markdown is not rendered.
- Keys stored in `localStorage` are readable by any script running on the same page, so host the file on a trusted origin and avoid shared computers.
- Providers must allow browser requests (CORS). All five listed above do.
- UnoRouter asks for a one-time consent per upstream provider before it serves some of its free models. When that happens the chat says so and links to the consent page; allow it once and the model answers from then on.
- What you get for free: OpenRouter's free models, the Gemini API free tier, Groq's free plan, Cohere trial keys (1,000 calls a month, 20 requests a minute, renewed monthly) and UnoRouter's `:free` models (no card, roughly one request per minute per model). None needs a prepaid balance that can be exhausted for good.
- Every provider above was checked to allow browser requests with the headers the app sends. Some otherwise free providers (Z.ai, Cloudflare Workers AI, NVIDIA NIM, Vercel AI Gateway) block browser calls, so they are deliberately not in the list. AIHubMix passes CORS but caps accounts that never recharged at 10 free requests in total, so it was dropped too.

## Support this project

The app is free, has no account, no ads and no tracking, and there is no paid tier to upsell. If it saves you time, a donation pays for the hours behind it and the next features.

**Donate in USDT →** one crypto address, no card, no account, no payment processor in between.

<p align="center">
  <img src="donate-usdt-qr.png" alt="QR code of the EVM donation address" width="200">
  <br>
  <sub>Scan with any wallet app</sub>
</p>

```
0xA2700896E16BE762467D458F2b45260f8FAC9F3e
```

This is a plain EVM address, so **the same address works on every EVM network**. Send USDT on whichever one suits you:

| Network | Token |
| --- | --- |
| BNB Smart Chain (BEP20) | USDT |
| Ethereum (ERC20) | USDT |
| Polygon | USDT |
| Arbitrum One | USDT |
| Base | USDT |
| Optimism | USDT |

Two rules: send **USDT only** (another token sent to this address cannot be recovered), and keep a little of the network's own coin (BNB, ETH, POL) in your wallet to pay the transfer fee. A non-EVM network such as Tron (TRC20) uses a different address format, so nothing sent there reaches this one.

## License

[MIT](LICENSE) © 2026 moonspiid — use it, modify it, ship it.
