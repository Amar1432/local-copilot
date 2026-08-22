# Task Breakdown

## Sprint 1 — Foundation & Infrastructure

**Goal:** Set up the monorepo structure, build tooling, and VS Code extension skeleton so the team has a working foundation for all subsequent development.

### Epic 1 — Project Setup

#### LC-001: Initialize Monorepo Structure
**Description:** Create the pnpm workspace monorepo structure with packages for extension, core, and shared utilities. Set up package.json, pnpm-workspace.yaml, and tsconfig.base.json.

**Acceptance Criteria:**
- pnpm-workspace.yaml configured with packages/*
- Root package.json with workspace scripts
- tsconfig.base.json with shared TypeScript config
- packages/extension, packages/core, packages/shared directories exist

#### LC-002: Configure Build Tooling
**Description:** Set up esbuild or tsup for the extension build pipeline. Configure ESLint and Prettier for code quality.

**Acceptance Criteria:**
- Build produces valid VS Code extension output
- ESLint runs without errors
- Prettier formats code consistently
- Build scripts in package.json work correctly

#### LC-003: Create VS Code Extension Skeleton
**Description:** Initialize the packages/extension package with minimal extension.ts, package.json (VS Code manifest), and activation events.

**Acceptance Criteria:**
- extension.ts exports activate/deactivate functions
- package.json has correct VS Code extension fields
- Extension activates on language:typescript, language:javascript
- Extension loads in VS Code without errors

### Epic 2 — Testing Framework

#### LC-004: Set Up Vitest Testing
**Description:** Configure Vitest for unit testing with proper TypeScript support and test directory structure.

**Acceptance Criteria:**
- Vitest config file created
- Sample test runs successfully
- Test scripts in package.json
- packages/core has test setup

#### LC-005: Create Test Fixtures and Mocks
**Description:** Set up mock provider, mock HTTP responses, and test utilities for provider and completion testing.

**Acceptance Criteria:**
- Mock HTTP server utilities created
- Mock provider implementation available
- Test fixtures for common scenarios exist
- Test helpers exported from shared package

### Epic 3 — CI/CD Foundation

#### LC-006: Configure CI Pipeline
**Description:** Create GitHub Actions or similar CI configuration for linting, testing, and building.

**Acceptance Criteria:**
- CI runs on PR and push to main
- Linting, type checking, and tests run
- Build produces artifacts
- CI passes on clean repo

---

## Sprint 2 — Core Completion Engine

**Goal:** Implement the completion orchestrator, request scheduler with debounce/cancellation, and basic caching so completions can be triggered and managed efficiently.

### Epic 4 — Completion Orchestrator

#### LC-007: Implement Completion Orchestrator
**Description:** Create the central coordinator that receives editor completion requests, manages the completion lifecycle, and returns VS Code completion items.

**Acceptance Criteria:**
- Orchestrator receives completion requests with document state
- Orchestrator coordinates context building, provider selection, and normalization
- Orchestrator returns InlineCompletionItem or empty array
- Orchestrator handles errors gracefully

#### LC-008: Implement Request Fingerprinting
**Description:** Create a fingerprinting system that generates unique identifiers for completion requests based on document state, position, and configuration.

**Acceptance Criteria:**
- Fingerprint includes documentUri, version, position, config hash
- Identical inputs produce identical fingerprints
- Different inputs produce different fingerprints
- Fingerprint computation is fast (<1ms)

### Epic 5 — Request Scheduler

#### LC-009: Implement Debounce Logic
**Description:** Create a debounce mechanism that delays completion requests until the user pauses typing.

**Acceptance Criteria:**
- Configurable debounce delay (default 150ms)
- Debounce resets on each keystroke
- Debounce does not block the editor
- Debounce can be bypassed for manual triggers

#### LC-010: Implement Request Cancellation
**Description:** Implement AbortController-based cancellation so stale requests are discarded when new input arrives.

**Acceptance Criteria:**
- Each request gets an AbortController
- Cancellation propagates to provider HTTP requests
- Cancelled requests do not return results
- Cancellation overhead is <50ms

#### LC-011: Implement Request Versioning
**Description:** Ensure requests track document version and only the latest version's results are shown.

**Acceptance Criteria:**
- Request includes documentVersion
- Response is discarded if documentVersion is stale
- Only the most recent request can produce visible output
- Version tracking is atomic

#### LC-012: Implement Request Deduplication
**Description:** Reuse in-flight requests when identical inputs are submitted repeatedly.

**Acceptance Criteria:**
- Same fingerprint reuses existing request
- Different fingerprints create new requests
- Deduplication does not cause stale results
- Deduplication is thread-safe

### Epic 6 — Caching

#### LC-013: Implement L1 Request Cache
**Description:** Create an in-memory cache for short-lived completion results based on request fingerprint.

**Acceptance Criteria:**
- Cache stores completion results by fingerprint
- Cache has configurable TTL
- Cache has size limits with LRU eviction
- Cache hit returns result without provider call

---

## Sprint 3 — Provider Abstraction & Local Provider

**Goal:** Define the provider interface and implement the first working provider (OpenAI-compatible) so completions can actually be generated from a model.

### Epic 7 — Provider Interface

#### LC-014: Define CompletionProvider Interface
**Description:** Create the TypeScript interface for completion providers with validation, model listing, and completion methods.

**Acceptance Criteria:**
- Interface defines id, validateConfig, getModels, complete methods
- ProviderCapabilities interface defined
- ModelInfo interface defined for model metadata
- Interface is extensible for future providers

#### LC-015: Implement Provider Router
**Description:** Create a router that selects the appropriate provider based on configuration and manages provider lifecycle.

**Acceptance Criteria:**
- Router selects provider from configuration
- Router validates provider configuration
- Router handles provider failures gracefully
- Router supports provider switching

### Epic 8 — OpenAI-Compatible Provider

#### LC-016: Implement OpenAI-Compatible Provider
**Description:** Create a provider adapter for OpenAI-compatible endpoints that handles authentication, request formatting, and response parsing.

**Acceptance Criteria:**
- Provider sends requests to configured baseUrl
- Provider supports API key authentication
- Provider handles streaming and non-streaming responses
- Provider implements proper error handling

#### LC-017: Implement FIM Support
**Description:** Add Fill-in-the-Middle support for providers that advertise FIM capability.

**Acceptance Criteria:**
- Provider detects FIM capability from model info
- Provider formats FIM requests with prefix/suffix tokens
- FIM requests produce correct completions
- FIM falls back to standard completion when unsupported

#### LC-018: Implement Model Discovery
**Description:** Add optional model listing via GET /v1/models endpoint for providers that support it.

**Acceptance Criteria:**
- Provider attempts model discovery on connection
- Model list is cached and refreshable
- Model list fallback allows manual entry
- Model capabilities are extracted from metadata

### Epic 9 — Secret Management

#### LC-019: Implement SecretStorage Integration
**Description:** Use VS Code SecretStorage for API key management with secure storage and retrieval.

**Acceptance Criteria:**
- API keys stored in SecretStorage, not plaintext
- API keys retrieved securely for provider requests
- API keys never logged or included in diagnostics
- API key update flow works correctly

#### LC-020: Implement Local-Only Mode
**Description:** Enforce local-only mode that blocks all remote requests and telemetry.

**Acceptance Criteria:**
- Local-only mode blocks remote providers
- Local-only mode blocks telemetry
- Local-only mode status is visible in UI
- Local-only mode cannot be bypassed accidentally

---

## Sprint 4 — Context Engine & Prompt Builder

**Goal:** Build the context extraction and prompt construction pipeline so models receive the right information for accurate completions.

### Epic 10 — Context Engine

#### LC-021: Implement Basic Context Extraction
**Description:** Extract prefix, suffix, current line, current function, and imports from the active document.

**Acceptance Criteria:**
- Context includes prefix and suffix around cursor
- Context includes current function scope
- Context includes imports and declarations
- Context extraction is fast (<20ms)

#### LC-022: Implement Context Ranking
**Description:** Score and rank context sources based on relevance to the current completion request.

**Acceptance Criteria:**
- Context sources are scored by relevance
- Top-K context items are selected
- Ranking is configurable
- Ranking is deterministic for same inputs

#### LC-023: Implement Context Caching
**Description:** Cache parsed document structure, symbols, and file metadata to avoid repeated parsing.

**Acceptance Criteria:**
- Parsed context is cached by document version
- Cache is invalidated on document changes
- Cache has size limits
- Cache improves repeated completion latency

### Epic 11 — Prompt Builder

#### LC-024: Implement Prompt Builder
**Description:** Create a prompt template system that constructs completion prompts from context and configuration.

**Acceptance Criteria:**
- Prompt includes language, file path, and context
- Prompt includes prefix and suffix markers
- Prompt respects token budgets
- Prompt versioning is supported

#### LC-025: Implement FIM Prompt Builder
**Description:** Create a FIM-specific prompt builder that formats prefix/suffix for fill-in-the-middle models.

**Acceptance Criteria:**
- FIM prompt uses correct tokens for the model
- FIM prompt includes context markers
- FIM prompt falls back to standard when unsupported
- FIM prompt is tested with multiple models

#### LC-026: Implement Completion Normalizer
**Description:** Clean up model output to remove markdown fences, prose, duplicates, and invalid syntax.

**Acceptance Criteria:**
- Normalizer removes markdown code fences
- Normalizer removes explanatory prose
- Normalizer removes duplicate prefix/suffix
- Normalizer validates insertion range

---

## Sprint 5 — UI Integration & Configuration

**Goal:** Wire everything into VS Code's UI, add status indicators, command palette commands, and make all settings configurable.

### Epic 12 — VS Code Integration

#### LC-027: Register InlineCompletionItemProvider
**Description:** Register the extension as an inline completion provider with VS Code for supported languages.

**Acceptance Criteria:**
- Extension registers for TypeScript, JavaScript, TSX, JSX
- Completions appear inline when typing
- Standard VS Code acceptance/dismissal works
- No interference with other extensions

#### LC-028: Implement Status Bar UI
**Description:** Create a status bar item showing provider, model, and connection status.

**Acceptance Criteria:**
- Status bar shows provider and model name
- Status bar shows connection status (connected/unavailable)
- Status bar updates on provider change
- Status bar click opens configuration

### Epic 13 — Configuration System

#### LC-029: Implement Configuration Settings
**Description:** Define and register all VS Code settings for provider, model, debounce, timeout, and other options.

**Acceptance Criteria:**
- All settings have defaults and descriptions
- Settings support user, workspace, and folder scopes
- Settings changes take effect without restart
- Settings validation prevents invalid values

#### LC-030: Implement Workspace Overrides
**Description:** Allow per-workspace configuration that overrides global settings.

**Acceptance Criteria:**
- Workspace settings override user settings
- Workspace settings are visible in VS Code settings
- Workspace settings can enable/disable features
- Workspace trust is respected

### Epic 14 — Commands & Diagnostics

#### LC-031: Implement Command Palette Commands
**Description:** Add commands for enable/disable, trigger completion, select model/provider, test connection, and diagnostics.

**Acceptance Criteria:**
- All PRD commands are registered
- Commands are discoverable in Command Palette
- Commands have appropriate enablement states
- Commands execute without errors

#### LC-032: Implement Diagnostics View
**Description:** Create a diagnostics command that shows provider status, last request info, cache stats, and errors.

**Acceptance Criteria:**
- Diagnostics show provider and model info
- Diagnostics show last request latency and status
- Diagnostics show cache hit/miss counts
- Diagnostics mask sensitive values

---

## Sprint 6 — Testing, Evaluation & Polish

**Goal:** Achieve production quality through comprehensive testing, performance optimization, and documentation.

### Epic 15 — Testing

#### LC-033: Write Unit Tests for Core Components
**Description:** Write unit tests for orchestrator, scheduler, cache, context engine, and normalizer.

**Acceptance Criteria:**
- Unit tests cover critical paths
- Unit tests run in CI
- Test coverage >80% for core modules
- Tests are fast (<1s total)

#### LC-034: Write Integration Tests
**Description:** Create integration tests for the full completion flow with mock providers.

**Acceptance Criteria:**
- Integration tests cover completion request lifecycle
- Integration tests cover cancellation scenarios
- Integration tests cover error handling
- Integration tests run in CI

### Epic 16 — Evaluation & Benchmarking

#### LC-035: Build Benchmark Tooling
**Description:** Create a benchmark runner that measures latency, acceptance rate, and quality metrics.

**Acceptance Criteria:**
- Benchmark runs against test corpus
- Benchmark reports P50/P95 latency
- Benchmark measures acceptance-like score
- Benchmark produces repeatable results

#### LC-036: Implement Online Metrics
**Description:** Add privacy-safe aggregate metrics for production telemetry (opt-in only).

**Acceptance Criteria:**
- Metrics include latency, acceptance, language
- Metrics never include source code
- Metrics are only collected when explicitly enabled
- Metrics can be disabled per-workspace

### Epic 17 — Performance & Polish

#### LC-037: Performance Optimization
**Description:** Profile and optimize the completion path for latency targets.

**Acceptance Criteria:**
- Local completion P50 <300ms on target hardware
- Context build <20ms
- Cache lookup <5ms
- No main thread blocking

#### LC-038: Documentation & Packaging
**Description:** Write README, configure VSIX packaging, and prepare for marketplace submission.

**Acceptance Criteria:**
- README documents installation and usage
- Extension packages as valid VSIX
- Extension installs cleanly in VS Code
- Documentation covers all configuration options
