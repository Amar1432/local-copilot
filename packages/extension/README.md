<p align="center">
  <img src="https://raw.githubusercontent.com/Amar1432/local-copilot/main/assets/logo.png" alt="Private Copilot Logo" width="128" />
</p>

# Private Copilot for Visual Studio Code

**Private, Fast, Configurable AI Autocomplete**

Private Copilot brings intelligent, low-latency AI code completion directly into your editor without sending your code to the cloud.

---

## ⚡ Key Features

- 🔒 **100% Local-First Privacy** — Source code stays on your machine (`localOnly` mode by default).
- 🚀 **Sub-300ms Autocomplete** — Instant keystroke debouncing, in-memory LRU request cache, and intelligent deduplication.
- 🧠 **Multi-File Context Engine** — Extracts imports, enclosing function/class scopes, and related workspace definitions with budget presets (`fast`, `balanced`, `rich`).
- 🔌 **Universal Provider Support** — Compatible with **Ollama**, **LM Studio**, **vLLM**, **OpenAI**, and custom OpenAI-compatible endpoints.
- 🎯 **Fill-in-the-Middle (FIM)** — Native support for Qwen 2.5 Coder, DeepSeek Coder, StarCoder2, and CodeLlama.
- 📊 **Diagnostics Dashboard** — Real-time Webview displaying latency percentiles (P50/P90/P95), acceptance rate, cache hit ratios, and language statistics.
- 🛠️ **Status Bar Controls** — Quick model switcher, latency indicator, and one-click connection tests.
- 🌐 **15+ Programming Languages** — TypeScript, JavaScript, Python, Go, Rust, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin, and more.

---

## 🚀 Getting Started

1. Start your local model runtime (e.g. `ollama run qwen2.5-coder:7b`).
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:
   ```
   Local Copilot: Setup Wizard
   ```
3. Follow the 5-step guided setup to connect to your endpoint and test connectivity.

---

## ⌨️ Common Commands

- `Local Copilot: Setup Wizard` — Guided configuration
- `Local Copilot: Status Bar Menu` — Interactive status menu
- `Local Copilot: Toggle Enable/Disable` — Turn autocomplete on or off
- `Local Copilot: Quick Settings` — Adjust settings without opening preferences
- `Local Copilot: Show Diagnostics` — Open real-time metrics dashboard
- `Local Copilot: Clear Cache` — Flush in-memory completion cache

---

## 📄 License

MIT
