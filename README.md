<p align="center">
  <img src="https://raw.githubusercontent.com/Amar1432/private-copilot/main/assets/logo.png" alt="Private Copilot Logo" width="128" />
</p>

# Private Copilot

**Private, Fast, Configurable AI Autocomplete for VS Code**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](<>)
[![Tests](https://img.shields.io/badge/tests-406%20passing-brightgreen.svg)](<>)

Private Copilot brings intelligent, real-time code autocomplete to VS Code with a zero-compromise focus on **local privacy**, **sub-300ms latency**, and **multi-file contextual understanding**.

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
git clone https://github.com/Amar1432/private-copilot.git
cd private-copilot

# Install dependencies and build
pnpm install
pnpm build

# Package VSIX extension
pnpm package

# Install VSIX into VS Code
code --install-extension packages/extension/private-copilot-0.1.0.vsix
```

### 3. Setup Wizard

Once installed, open the VS Code Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:

```text
Private Copilot: Setup Wizard
```

The guided 5-step wizard will configure your provider, base URL, discover local models, optionally store your API key, and test connectivity.

---

## ⚙️ Configuration

Configure Private Copilot via VS Code Settings (`Cmd+,` / `Ctrl+,` search `privateCopilot`):

| Setting                               | Type      | Default                     | Description                                                                         |
| :------------------------------------ | :-------- | :-------------------------- | :---------------------------------------------------------------------------------- |
| `privateCopilot.enabled`              | `boolean` | `true`                      | Enable/disable inline code completions                                              |
| `privateCopilot.provider`             | `enum`    | `custom`                    | Provider: `custom`, `ollama`, `openai`, `lmstudio`, `vllm`                          |
| `privateCopilot.baseUrl`              | `string`  | `http://localhost:11434/v1` | Base URL of the OpenAI-compatible inference endpoint                                |
| `privateCopilot.model`                | `string`  | `""`                        | Model identifier (e.g. `qwen2.5-coder:7b`, `deepseek-coder:6.7b`)                   |
| `privateCopilot.apiKey`               | `string`  | `""`                        | Stored securely in VS Code `SecretStorage`                                          |
| `privateCopilot.localOnly`            | `boolean` | `true`                      | When true, hard-blocks all remote network requests                                  |
| `privateCopilot.debounceMs`           | `number`  | `150`                       | Debounce delay before dispatching completion request (0–1000ms)                     |
| `privateCopilot.requestTimeoutMs`     | `number`  | `2000`                      | Abort request timeout in milliseconds (500–10000ms)                                 |
| `privateCopilot.temperature`          | `number`  | `0.1`                       | Sampling temperature for code generation (0.0–1.0)                                  |
| `privateCopilot.maxOutputTokens`      | `number`  | `128`                       | Maximum output completion tokens (1–1024)                                           |
| `privateCopilot.context.maxLines`     | `number`  | `120`                       | Maximum surrounding prefix/suffix lines from active file                            |
| `privateCopilot.context.budgetPreset` | `enum`    | `balanced`                  | Context budget: `fast` (512 tokens), `balanced` (1024 tokens), `rich` (2048 tokens) |
| `privateCopilot.telemetry.enabled`    | `boolean` | `false`                     | Anonymized aggregate telemetry (strictly opt-in, zero code retention)               |

---

## ⌨️ Commands

| Command                   | Command ID                         | Description                                                |
| :------------------------ | :--------------------------------- | :--------------------------------------------------------- |
| **Setup Wizard**          | `privateCopilot.setupWizard`       | 5-step guided onboarding & connection check                |
| **Status Bar Menu**       | `privateCopilot.statusBarMenu`     | Interactive quick pick menu for status & settings          |
| **Toggle Enable/Disable** | `privateCopilot.toggle`            | Quickly toggle autocomplete on or off                      |
| **Quick Settings**        | `privateCopilot.quickSettings`     | Change debounce, temperature, model, or preset on the fly  |
| **Select Model**          | `privateCopilot.selectModel`       | Discover models from live endpoint or enter manually       |
| **Select Provider**       | `privateCopilot.selectProvider`    | Switch between Ollama, LM Studio, vLLM, OpenAI, Custom     |
| **Test Connection**       | `privateCopilot.testConnection`    | Verify provider availability and measure roundtrip latency |
| **Show Diagnostics**      | `privateCopilot.showDiagnostics`   | Open real-time Webview diagnostics & metrics panel         |
| **Clear Cache**           | `privateCopilot.clearCache`        | Flush in-memory L1 LRU request cache                       |
| **Export Diagnostics**    | `privateCopilot.exportDiagnostics` | Copy full system diagnostics JSON to clipboard             |
| **Export Telemetry**      | `privateCopilot.exportTelemetry`   | Copy anonymized aggregate telemetry JSON to clipboard      |
| **Set API Key**           | `privateCopilot.setApiKey`         | Securely store API key in VS Code SecretStorage            |
| **Clear API Key**         | `privateCopilot.deleteApiKey`      | Clear stored credentials for active provider               |

---

## 🧪 Benchmarking & Performance Profiling

Private Copilot includes an automated evaluation and performance profiling suite:

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
private-copilot/
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

MIT © [Private Copilot Contributors](LICENSE)
