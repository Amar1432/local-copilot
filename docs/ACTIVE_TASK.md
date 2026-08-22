# Active Task

## Sprint 2 — Core Completion Engine

**Active focus:** Implementing the core completion pipeline, request scheduling, debounce/cancellation, fingerprinting, and in-memory L1 request caching.

### Scope

- Completion orchestrator coordinating the lifecycle
- Context extraction (prefix/suffix) & fingerprinting
- Request scheduler with debounce and cancellation
- Fill-in-the-Middle (FIM) and standard prompt builders
- Completion normalizer for output cleanup
- L1 Request Cache with LRU eviction and TTL

### Out of Scope

- Multi-provider abstraction and discovery (Sprint 3)
- Multi-file repository context (Sprint 4)
- Webview UI or advanced diagnostics view (Sprint 5)

### Progress

- [x] LC-007: Implement Completion Orchestrator
- [x] LC-008: Implement Request Fingerprinting
- [x] LC-009: Implement Debounce Logic
- [x] LC-010: Implement Request Cancellation
- [x] LC-011: Implement Request Versioning
- [x] LC-012: Implement Request Deduplication
- [x] LC-013: Implement L1 Request Cache

### Sprint 2 Complete! 🎉

All core completion engine and scheduling tickets are done. Ready for Sprint 3.

---

### Next Ticket: **LC-014: Define CompletionProvider Interface**

**Sprint:** Sprint 3 — Provider Abstraction & Local Provider  
**Epic:** Epic 7 — Provider Interface  
**Goal:** Create the TypeScript interface for completion providers with validation, model listing, and completion methods in `@local-copilot/core` / shared types.

**Acceptance Criteria:**

- Interface defines `id`, `validateConfig`, `getModels`, `complete` methods
- `ProviderCapabilities` interface defined
- `ModelInfo` interface defined for model metadata
- Interface is extensible for future providers
