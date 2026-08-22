# Architecture

## System Overview

Local Copilot is a VS Code extension that provides AI-powered inline code completion. The architecture is designed for low latency, privacy, and provider flexibility.

## Component Table

| Component | Technology Stack | Core Responsibility | Hosting Target |
|---|---|---|---|
| VS Code Extension Host | TypeScript, VS Code API | Editor integration, lifecycle management | VS Code Extension |
| Completion Orchestrator | TypeScript | Request coordination, lifecycle management | VS Code Extension |
| Request Scheduler | TypeScript, AbortController | Debounce, cancellation, deduplication | VS Code Extension |
| Context Engine | TypeScript, VS Code Language APIs | Context extraction, ranking, caching | VS Code Extension |
| Prompt Builder | TypeScript | Prompt construction, FIM formatting | VS Code Extension |
| Provider Router | TypeScript | Provider selection, capability detection | VS Code Extension |
| OpenAI-Compatible Provider | TypeScript, Fetch API | HTTP communication with AI endpoints | Local/Remote |
| Completion Normalizer | TypeScript | Output validation, cleanup, insertion | VS Code Extension |
| Secret Storage | VS Code SecretStorage API | Secure credential management | VS Code Extension |
| Cache (L1/L2/L3) | TypeScript Map/LRU | Request caching, context caching | VS Code Extension |
| Diagnostics | TypeScript, VS Code APIs | Metrics collection, status reporting | VS Code Extension |

## Repository Structure

```
local-copilot/
├── packages/
│   ├── extension/           # VS Code extension package
│   │   ├── src/
│   │   │   ├── extension.ts          # Entry point
│   │   │   ├── completion/           # Completion orchestrator
│   │   │   ├── providers/            # Provider implementations
│   │   │   ├── context/              # Context engine
│   │   │   ├── scheduler/            # Request scheduling
│   │   │   ├── cache/                # Caching layers
│   │   │   ├── configuration/        # Settings management
│   │   │   ├── security/             # Secret storage
│   │   │   ├── diagnostics/          # Metrics and status
│   │   │   └── ui/                   # Status bar, commands
│   │   ├── package.json              # VS Code extension manifest
│   │   └── tsconfig.json
│   │
│   ├── core/                # Shared core logic
│   │   ├── src/
│   │   │   ├── completion/           # Completion types and interfaces
│   │   │   ├── providers/            # Provider interfaces
│   │   │   ├── context/              # Context types
│   │   │   ├── normalization/        # Normalizer logic
│   │   │   └── evaluation/           # Benchmark tools
│   │   └── package.json
│   │
│   └── shared/              # Shared utilities
│       ├── src/
│       │   ├── types/                # Common types
│       │   ├── utils/                # Utility functions
│       │   └── constants/            # Shared constants
│       └── package.json
│
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── fixtures/            # Test fixtures
│
├── benchmarks/
│   ├── latency/             # Latency benchmarks
│   ├── accuracy/            # Accuracy benchmarks
│   └── datasets/            # Test datasets
│
├── docs/                    # Documentation
├── package.json             # Root package.json
├── pnpm-workspace.yaml      # Workspace config
├── tsconfig.base.json       # Base TypeScript config
└── README.md
```

## Data Flows

### Completion Request Flow

```
User Types
    │
    ▼
VS Code Completion Provider
    │
    ▼
Completion Orchestrator
    │
    ├─► Check L1 Cache ──► Cache Hit? ──► Return Cached
    │
    ▼
Request Scheduler
    │
    ├─► Debounce (150ms default)
    ├─► Check Active Requests (deduplication)
    │
    ▼
Context Engine
    │
    ├─► Extract Prefix/Suffix
    ├─► Extract Current Function
    ├─► Extract Imports/Symbols
    ├─► Rank Context Sources
    │
    ▼
Prompt Builder
    │
    ├─► Format Prompt (standard or FIM)
    ├─► Apply Token Budget
    │
    ▼
Provider Router
    │
    ├─► Select Provider (local/cloud)
    ├─► Check Provider Capabilities
    │
    ▼
Provider (OpenAI-Compatible)
    │
    ├─► HTTP Request (Fetch + AbortController)
    ├─► Parse Response
    │
    ▼
Completion Normalizer
    │
    ├─► Remove Markdown/Prose
    ├─► Remove Duplicates
    ├─► Validate Syntax
    │
    ▼
Return InlineCompletionItem
```

### Configuration Flow

```
User Settings
    │
    ▼
VS Code Configuration API
    │
    ├─► Merge: Defaults → User → Workspace
    │
    ▼
Configuration Manager
    │
    ├─► Validate Settings
    ├─► Resolve Secrets
    │
    ▼
Extension Components
```

## Storage Strategy

### In-Memory Caches

| Cache | Purpose | TTL | Size Limit |
|---|---|---|---|
| L1 Request | Avoid duplicate provider calls | 5s | 100 entries |
| L2 Completion | Reuse recent completions | 30s | 500 entries |
| L3 Context | Cache parsed document structure | 60s | 200 entries |

### Persistent Storage

| Storage | Purpose | Location |
|---|---|---|
| SecretStorage | API keys, tokens | VS Code SecretStorage |
| Extension State | Extension preferences | VS Code GlobalState |
| Workspace Settings | Per-project config | .vscode/settings.json |

### No Persistent Code Storage

The MVP does NOT persist source code to disk. All context extraction happens in-memory and is discarded after use.

## Security Model

### Credential Handling
- API keys stored in VS Code SecretStorage (encrypted)
- Never logged, included in diagnostics, or exposed to other extensions
- Masked in all user-facing displays

### Local-Only Mode
- When enabled, blocks ALL remote requests
- Enforced at the provider router level
- Cannot be bypassed by configuration

### Data Privacy
- Source code never leaves the machine in local mode
- Cloud mode sends only configured context (prefix/suffix)
- Telemetry (opt-in) never includes source code
- No persistent code caching to disk

## Performance Targets

| Metric | Target | Notes |
|---|---|---|
| Extension activation | <500ms | Incremental impact |
| Scheduling overhead | <10ms | Debounce + versioning |
| Context build | <20ms | Simple context |
| Cache lookup | <5ms | L1 hit |
| Local completion P50 | <300ms | Hardware dependent |
| Cloud completion P50 | <500ms | Network dependent |
| Cancellation response | <50ms | Where provider permits |
| Suggestion normalization | <10ms | Post-processing |
| Main UI blocking | ~0ms | Async throughout |

## Assumptions

1. **Local models are small** — MVP targets small code models (1-7B parameters) for acceptable latency
2. **OpenAI-compatible API** — All providers implement the OpenAI completions API format
3. **Single-file context** — MVP focuses on current-file context; repository context is deferred
4. **No streaming for MVP** — Non-streaming completion is simpler and sufficient for small outputs
5. **VS Code as sole target** — No support for other editors in MVP
