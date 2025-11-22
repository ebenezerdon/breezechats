# BreezeChats

BreezeChats is a super clean, single-purpose chat UI that runs entirely in your browser using WebLLM. It is built by [Teda.dev](https://teda.dev), the AI app builder for everyday problems, and focuses on privacy, speed, and a streamlined experience.

## Features
- Client-side AI with WebLLM (no servers, no accounts)
- Streaming responses with a Stop button
- Visible model download progress and status
- Messages and model choice persisted in localStorage
- Keyboard-friendly: Enter to send, Shift+Enter for new line
- Responsive, accessible design with subtle animations

## Getting started
1. Open index.html for the landing page.
2. Click Open Chat to go to app.html, which loads the model automatically.

First load downloads the model to IndexedDB (a few GB). Subsequent sessions use the cache and start quickly.

## Browser requirements
- WebGPU-capable browser: Chrome/Edge 113+ or Firefox 118+
- Sufficient GPU memory (the default model is roughly 3.4 GB)

If your device struggles, consider changing the model id in localStorage key `app.llm.model` to `Qwen2.5-3B-Instruct-q4f16_1-MLC`.

## Project structure
- index.html – Landing page
- app.html – Main chat app
- styles/main.css – Custom CSS and animations
- scripts/helpers.js – Utility helpers
- scripts/ai.js – WebLLM wrapper (ESM, no bundler)
- scripts/ui.js – App logic, rendering, event handling
- scripts/main.js – Orchestration and bootstrapping
- images/logo.svg – App logo

## Notes
- Everything runs locally. The model and weights are cached in IndexedDB.
- If WebGPU is not available, the app shows an error in the header status.

## Accessibility
- Semantic roles for the messages region
- Focus-visible rings and large touch targets
- Respects prefers-reduced-motion
