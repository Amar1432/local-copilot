# Engineering Roadmap

## Sprint 1: Foundation & Infrastructure

- Initialize monorepo structure with pnpm workspaces
- Set up TypeScript, ESLint, and build tooling (esbuild/tsup)
- Create VS Code extension package skeleton
- Configure VS Code extension manifest (package.json)
- Set up testing framework (Vitest)
- Create basic CI/CD pipeline configuration

## Sprint 2: Core Completion Engine

- Implement Completion Orchestrator
- Implement Request Scheduler with debounce, cancellation, and deduplication
- Implement request versioning and fingerprinting
- Create L1 In-Memory Request Cache
- Implement Completion Normalizer for output validation

## Sprint 3: Provider Abstraction & Local Provider

- Define CompletionProvider interface and capability metadata
- Implement OpenAI-compatible provider adapter
- Implement local provider with baseUrl configuration
- Implement API key storage using VS Code SecretStorage
- Add provider validation and model discovery

## Sprint 4: Context Engine & Prompt Builder

- Implement basic context engine with prefix/suffix extraction
- Create prompt/FIM builder for completion requests
- Add language detection and context selection
- Implement context ranking for multi-file scenarios
- Add context caching (L2/L3)

## Sprint 5: UI Integration & Configuration

- Implement VS Code InlineCompletionItemProvider registration
- Create status bar UI for provider/model status
- Implement configuration system with workspace overrides
- Add command palette commands
- Create diagnostics view

## Sprint 6: Testing, Evaluation & Polish

- Write unit tests for core components
- Create integration tests for completion flow
- Build benchmark/evaluation tooling
- Performance optimization and profiling
- Documentation and packaging preparation
