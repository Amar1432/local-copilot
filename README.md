# Local Copilot

**Private, Fast, Configurable AI Autocomplete for VS Code**

Local Copilot is a VS Code extension that provides AI-powered inline code completion with a focus on privacy, speed, and developer control.

## Features

- **Local-First Privacy** — Run models locally, your code never leaves your machine
- **Bring Your Own Model** — Use any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, etc.)
- **Fast Autocomplete** — Optimized for low-latency inline completions
- **Configurable** — Fine-tune debounce, context, and provider settings
- **FIM Support** — Fill-in-the-Middle for models that support it

## Quick Start

### Prerequisites

- VS Code 1.74.0 or later
- Node.js 18+ and pnpm 8+
- A local model server (Ollama, LM Studio, or any OpenAI-compatible API)

### Installation

```bash
# Install dependencies
pnpm install

# Build the extension
pnpm build

# Package the extension
pnpm package

# Install the extension
code --install-extension packages/extension/*.vsix
```

### Development

```bash
# Start development mode
pnpm dev

# Run tests
pnpm test

# Run linter
pnpm lint

# Type check
pnpm typecheck
```

## Configuration

Open VS Code settings and search for "Local Copilot":

| Setting                         | Default                     | Description                  |
| ------------------------------- | --------------------------- | ---------------------------- |
| `localCopilot.enabled`          | `true`                      | Enable/disable the extension |
| `localCopilot.provider`         | `custom`                    | Provider type                |
| `localCopilot.baseUrl`          | `http://localhost:11434/v1` | Provider base URL            |
| `localCopilot.model`            | `""`                        | Model identifier             |
| `localCopilot.localOnly`        | `true`                      | Block all remote requests    |
| `localCopilot.debounceMs`       | `150`                       | Debounce delay (ms)          |
| `localCopilot.requestTimeoutMs` | `2000`                      | Request timeout (ms)         |

## Supported Providers

- **Ollama** — `http://localhost:11434/v1`
- **LM Studio** — `http://localhost:1234/v1`
- **vLLM** — `http://localhost:8000/v1`
- **OpenAI** — `https://api.openai.com/v1`
- **Custom** — Any OpenAI-compatible endpoint

## Commands

| Command                             | Description                 |
| ----------------------------------- | --------------------------- |
| `Local Copilot: Enable`             | Enable the extension        |
| `Local Copilot: Disable`            | Disable the extension       |
| `Local Copilot: Trigger Completion` | Manually trigger completion |
| `Local Copilot: Select Model`       | Choose a model              |
| `Local Copilot: Test Connection`    | Test provider connection    |
| `Local Copilot: Show Diagnostics`   | View diagnostics            |
| `Local Copilot: Clear Cache`        | Clear completion cache      |
| `Local Copilot: Open Settings`      | Open extension settings     |

## Documentation

- [Product Requirements](PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Design System](docs/DESIGN_SYSTEM.md)
- [Deployment](docs/DEPLOYMENT.md)

## Contributing

1. Read the [AI.md](AI.md) file for workflow and conventions
2. Check [docs/ACTIVE_TASK.md](docs/ACTIVE_TASK.md) for current tasks
3. Follow the reading order in [docs/README.md](docs/README.md)

## License

MIT
