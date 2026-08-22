# Deployment

## Infrastructure Overview

Local Copilot is a VS Code extension distributed as a VSIX package. No backend infrastructure is required for the extension itself.

### Distribution

| Component | Target | Method |
|---|---|---|
| Extension Package | VS Code Marketplace | VSIX via vsce |
| Development Builds | Local testing | pnpm build |
| CI Artifacts | Automated testing | GitHub Actions |

## Build Commands

### Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build extension only
pnpm --filter @local-copilot/extension build

# Watch mode
pnpm dev

# Run tests
pnpm test

# Run linter
pnpm lint

# Package extension
pnpm package
```

### Production

```bash
# Full production build
pnpm build --production

# Package for distribution
pnpm package

# The VSIX file will be in the extension/dist directory
```

## Environment Variables

### Development

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Environment mode | `development` |
| `LOCAL_COPILOT_DEBUG` | Enable debug logging | `false` |
| `LOCAL_COPILOT_LOG_LEVEL` | Log verbosity | `warn` |

### Runtime (VS Code Settings)

| Setting | Description | Default |
|---|---|---|
| `localCopilot.enabled` | Enable extension | `true` |
| `localCopilot.provider` | Provider type | `custom` |
| `localCopilot.baseUrl` | Provider URL | `http://localhost:11434/v1` |
| `localCopilot.model` | Model name | `""` |
| `localCopilot.localOnly` | Local-only mode | `true` |
| `localCopilot.debounceMs` | Debounce delay | `150` |
| `localCopilot.requestTimeoutMs` | Request timeout | `2000` |

## VS Code Version Compatibility

### Minimum Version
- VS Code 1.74.0 (or as required by APIs used)

### Tested Versions
- VS Code 1.74.0
- VS Code 1.80.0
- VS Code Latest Stable

### API Usage
- `InlineCompletionItemProvider` (stable)
- `SecretStorage` (stable)
- `StatusBarItem` (stable)
- `commands` (stable)

## Installation Methods

### VS Code Marketplace
```
ext install local-copilot.local-copilot
```

### VSIX Manual Install
```
code --install-extension local-copilot-0.1.0.vsix
```

### Development Install
```bash
# In VS Code, press F5 to launch Extension Development Host
pnpm dev
```

## Local Provider Setup

### Ollama
```bash
# Install Ollama
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama
ollama serve

# Pull a coding model
ollama pull qwen-coder
```

### LM Studio
```bash
# Download from https://lmstudio.ai
# Install and launch
# Download a coding model through the app
# Start the local server
```

### Custom Endpoint
```bash
# Any OpenAI-compatible API
# Configure in VS Code settings:
# localCopilot.baseUrl = "http://localhost:8000/v1"
# localCopilot.model = "your-model"
```

## Known Gotchas

_(Start empty; agents append deploy lessons over time)_

- No known issues yet.
- Add issues as they are discovered during development and deployment.

## Troubleshooting

### Extension Not Loading
1. Check VS Code version compatibility
2. Reload VS Code window (Developer: Reload Window)
3. Check extension output channel for errors

### Completions Not Appearing
1. Verify provider is connected (check status bar)
2. Check provider logs for errors
3. Test connection via Command Palette

### Slow Completions
1. Check provider latency in diagnostics
2. Reduce context size in settings
3. Use a smaller/faster model

### API Key Issues
1. Verify key is stored in SecretStorage
2. Test connection via Command Palette
3. Check provider documentation

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Run full test suite
4. Build production bundle
5. Package VSIX
6. Test VSIX in clean VS Code
7. Publish to marketplace (manual approval)

## Rollback

If issues are discovered after release:
1. Revert to previous VSIX
2. Users can install previous version from marketplace
3. Publish hotfix if critical

## Monitoring

### User-Facing Metrics (Opt-in Only)
- Completion latency
- Acceptance rate
- Error rate
- Provider availability

### Development Metrics
- Test coverage
- Build success rate
- Lint warnings
- Bundle size
