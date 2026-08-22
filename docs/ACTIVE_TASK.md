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
- [x] LC-025: Implement Context Window Budgeting
- [x] LC-026: Implement Cross-File Deduplication
- [ ] LC-027: Integrate Multi-File Context with Orchestrator

---

### Next Ticket: **LC-027: Integrate Multi-File Context with Orchestrator**

**Sprint:** Sprint 4 — Context Engine & Multi-File Support  
**Epic:** Epic 11 — Context Interface  
**Goal:** Wire the file, recent, and import/definition context providers into the Completion Orchestrator pipeline so all providers contribute chunks assembled under the global budget.

**Acceptance Criteria:**

- Orchestrate all registered context providers in the Completion Orchestrator's completion flow
- Apply cross-file deduplication and budget enforcement before prompt assembly
- Expose a configurable budget preset selection via extension settings
- Maintain <20ms total context assembly overhead for typical completions
