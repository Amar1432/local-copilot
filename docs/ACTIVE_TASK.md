# Active Task

## Sprint 4 — Context Engine & Multi-File Support

**Active focus:** Multi-file context extraction, recent file tracking, import/definition resolution, context window budgeting, and cross-file deduplication for completions.

### Scope

- Context provider interface and context contracts in `@local-copilot/core`
- Active file context extraction with cursor-relative semantic chunks
- Recent files tracking and LRU buffer management
- TypeScript/JavaScript import and definition resolution
- Context window token budgeting and truncation
- Cross-file duplicate chunk detection and deduplication
- Integration with Completion Orchestrator pipeline

### Out of Scope

- Full AST parsing / tree-sitter bindings (keep lightweight regex/heuristic first)
- Webview UI or status panel diagnostics (Sprint 5)

### Progress

- [x] LC-021: Define Context Provider Interface
- [x] LC-022: Implement File Context Extractor
- [x] LC-023: Implement Recent Files Provider
- [x] LC-024: Implement Import/Definition Resolver
- [ ] LC-025: Implement Context Window Budgeting
- [ ] LC-026: Implement Cross-File Deduplication
- [ ] LC-027: Integrate Multi-File Context with Orchestrator

---

### Next Ticket: **LC-025: Implement Context Window Budgeting**

**Sprint:** Sprint 4 — Context Engine & Multi-File Support  
**Epic:** Epic 11 — Context Interface  
**Goal:** Enforce a single deterministic token budget across all context provider chunks before prompt assembly, with reserved space for the active prefix/suffix.

**Acceptance Criteria:**

- Aggregate chunks from all providers into one ranked selection under a global token budget
- Reserve tokens for the prompt template and active prefix/suffix before allocating context
- Enforce per-chunk and global line/token caps deterministically
- Support configurable budget presets (e.g., fast vs rich context) without code changes
