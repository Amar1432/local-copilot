# Local Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-406%20passing-brightgreen.svg)]()

**Private, Fast, Configurable AI Autocomplete for VS Code**

Local Copilot brings intelligent, real-time code autocomplete to VS Code with a zero-compromise focus on **local privacy**, **sub-300ms latency**, and **multi-file contextual understanding**.

---

## ⚡ Highlights

- 🔒 **100% Local-First Privacy** — Built-in `localOnly` safeguard ensures your source code never leaves your machine unless you explicitly configure remote providers.
- 🚀 **Sub-300ms Latency SLA** — Ultra-fast debounce scheduling, version tracking, L1 in-memory LRU request caching, and duplicate suppression.
- 🧠 **Multi-File Context Engine** — Automatically gathers semantic imports, enclosing function/class scopes, recent workspace symbols, and cross-file definitions within configurable token budgets (`fast`, `balanced`, `rich`).
- 🔌 **Bring Your Own Model (BYOM)** — Native compatibility with **Ollama**, **LM Studio**, **vLLM**, **OpenAI**, and any custom OpenAI-compatible server.
- 🎯 **First-Class FIM Support** — Automatic Fill-in-the-Middle tokenization for Qwen 2.5 Coder, DeepSeek Coder, StarCoder2, CodeLlama, and more.
- 📊 **Real-Time Diagnostics & Metrics** — Interactive Webview panel displaying live latency percentiles (P50/P90/P95/P99), acceptance rates, cache hit ratios, and language breakdowns.
- 🛠️ **Status Bar & Quick Actions** — Click-to-configure status bar showing active model name, real-time latency indicators, and quick toggle controls.
- 🌐 **15+ Programming Languages** — Full support for TypeScript, JavaScript, TSX, JSX, Python, Go, Rust, Java, C, C++, C#, Ruby, PHP, Swift, and Kotlin.
- 🔑 **Secure Keyring Storage** — Uses VS Code `SecretStorage` for encrypted credential management with automatic masking in logs and UI.

---

## 📦 Quick Start

### 1. Prerequisites
- **VS Code:** `1.74.0` or later
- **Node.js:** `18+` and **pnpm:** `8+`
- **Local Model Runtime:** [Ollama](https://ollama.com/), [LM Studio](https://lmstudio.ai/), or [vLLM](https://github.com/vllm-project/vllm)

```bash
# Example: Pull and start a local coder model with Ollama
ollama pull qwen2.5-coder:7b
ollama serve
```

### 2. Installation & Build

```bash
# Clone repository
git clone https://github.com/Amar1432/local-copilot.git
cd local-copilot

# Install dependencies and build
pnpm install
pnpm build

# Package VSIX extension
pnpm package

# Install VSIX into VS Code
code --install-extension packages/extension/local-copilot-0.1.0.vsix
```

### 3. Setup Wizard
Once installed, open the VS Code Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:
```text
Local Copilot: Setup Wizard
```
The guided 5-step wizard will configure your provider, base URL, discover local models, optionally store your API key, and test connectivity.

---

## ⚙️ Configuration

Configure Local Copilot via VS Code Settings (`Cmd+,` / `Ctrl+,` search `localCopilot`):

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `localCopilot.enabled` | `boolean` | `true` | Enable/disable inline code completions |
| `localCopilot.provider` | `enum` | `custom` | Provider: `custom`, `ollama`, `openai`, `lmstudio`, `vllm` |
| `localCopilot.baseUrl` | `string` | `http://localhost:11434/v1` | Base URL of the OpenAI-compatible inference endpoint |
| `localCopilot.model` | `string` | `""` | Model identifier (e.g. `qwen2.5-coder:7b`, `deepseek-coder:6.7b`) |
| `localCopilot.apiKey` | `string` | `""` | Stored securely in VS Code `SecretStorage` |
| `localCopilot.localOnly` | `boolean` | `true` | When true, hard-blocks all remote network requests |
| `localCopilot.debounceMs` | `number` | `150` | Debounce delay before dispatching completion request (0–1000ms) |
| `localCopilot.requestTimeoutMs` | `number` | `2000` | Abort request timeout in milliseconds (500–10000ms) |
| `localCopilot.temperature` | `number` | `0.1` | Sampling temperature for code generation (0.0–1.0) |
| `localCopilot.maxOutputTokens` | `number` | `128` | Maximum output completion tokens (1–1024) |
| `localCopilot.context.maxLines` | `number` | `120` | Maximum surrounding prefix/suffix lines from active file |
| `localCopilot.context.budgetPreset` | `enum` | `balanced` | Context budget: `fast` (512 tokens), `balanced` (1024 tokens), `rich` (2048 tokens) |
| `localCopilot.telemetry.enabled` | `boolean` | `false` | Anonymized aggregate telemetry (strictly opt-in, zero code retention) |

---

## ⌨️ Commands

| Command | Command ID | Description |
| :--- | :--- | :--- |
| **Setup Wizard** | `localCopilot.setupWizard` | 5-step guided onboarding & connection check |
| **Status Bar Menu** | `localCopilot.statusBarMenu` | Interactive quick pick menu for status & settings |
| **Toggle Enable/Disable** | `localCopilot.toggle` | Quickly toggle autocomplete on or off |
| **Quick Settings** | `localCopilot.quickSettings` | Change debounce, temperature, model, or preset on the fly |
| **Select Model** | `localCopilot.selectModel` | Discover models from live endpoint or enter manually |
| **Select Provider** | `localCopilot.selectProvider` | Switch between Ollama, LM Studio, vLLM, OpenAI, Custom |
| **Test Connection** | `localCopilot.testConnection` | Verify provider availability and measure roundtrip latency |
| **Show Diagnostics** | `localCopilot.showDiagnostics` | Open real-time Webview diagnostics & metrics panel |
| **Clear Cache** | `localCopilot.clearCache` | Flush in-memory L1 LRU request cache |
| **Export Diagnostics** | `localCopilot.exportDiagnostics` | Copy full system diagnostics JSON to clipboard |
| **Export Telemetry** | `localCopilot.exportTelemetry` | Copy anonymized aggregate telemetry JSON to clipboard |
| **Set API Key** | `localCopilot.setApiKey` | Securely store API key in VS Code SecretStorage |
| **Clear API Key** | `localCopilot.deleteApiKey` | Clear stored credentials for active provider |

---

## 🧪 Benchmarking & Performance Profiling

Local Copilot includes an automated evaluation and performance profiling suite:

```bash
# Run evaluation benchmark suite across multi-language dataset
pnpm benchmark

# Run benchmark against a live Ollama endpoint
node --loader ts-node/esm benchmarks/run-benchmark.ts --model qwen2.5-coder:7b --endpoint http://localhost:11434/v1
```

### Performance SLAs
- **Context Build:** `<20ms` (P50 `<5ms`, P95 `<12ms`)
- **Cache Lookup:** `<5ms` (measured `<0.05ms`)
- **FIM Assembly:** `<2ms` (measured `<0.02ms`)
- **Local P50 Latency:** `<300ms` on Apple Silicon / modern GPU inference

---

## 🏗️ Architecture

```
local-copilot/
├── packages/
│   ├── core/                  # Core domain & completion logic
│   │   ├── src/
│   │   │   ├── context/       # Semantic AST & multi-file context engine
│   │   │   ├── evaluation/    # Benchmark runner & performance profiler
│   │   │   ├── metrics/       # Metrics tracker & privacy telemetry exporter
│   │   │   └── providers/     # OpenAI-compatible provider, FIM, model discovery
│   ├── shared/                # Shared interfaces, constants & schemas
│   └── extension/             # VS Code extension host & UI
│       ├── src/
│       │   ├── completion-provider.ts     # InlineCompletionItemProvider
│       │   ├── completion-orchestrator.ts # Debounce, versioning, L1 cache
│       │   ├── diagnostics-panel.ts       # Real-time Webview dashboard
│       │   ├── status-bar.ts              # Status bar item & quick menu
│       │   └── secret-manager.ts          # VS Code SecretStorage wrapper
└── benchmarks/                # Test datasets & CLI benchmark runner
```

---

## 📜 License

MIT © [Local Copilot Contributors](LICENSE)
