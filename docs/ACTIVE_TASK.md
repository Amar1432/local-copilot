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
- [ ] LC-024: Implement Import/Definition Resolver
- [ ] LC-025: Implement Context Window Budgeting
- [ ] LC-026: Implement Cross-File Deduplication
- [ ] LC-027: Integrate Multi-File Context with Orchestrator

---

### Next Ticket: **LC-024: Implement Import/Definition Resolver**

**Sprint:** Sprint 4 — Context Engine & Multi-File Support  
**Epic:** Epic 11 — Context Interface  
**Goal:** Resolve import specifiers in the active TypeScript/JavaScript file to workspace files and extract symbol chunks from resolved definitions.

**Acceptance Criteria:**

- Resolve relative and index-based import specifiers in TypeScript/JavaScript to workspace file URIs
- Extract symbol or chunk content from resolved definition/imported files
- Assign priority scores based on import relationship strength
- Provide non-blocking async retrieval with cancellation support
