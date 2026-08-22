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

- [ ] LC-021: Define Context Provider Interface
- [ ] LC-022: Implement File Context Extractor
- [ ] LC-023: Implement Recent Files Provider
- [ ] LC-024: Implement Import/Definition Resolver
- [ ] LC-025: Implement Context Window Budgeting
- [ ] LC-026: Implement Cross-File Deduplication
- [ ] LC-027: Integrate Multi-File Context with Orchestrator

---

### Next Ticket: **LC-021: Define Context Provider Interface**

**Sprint:** Sprint 4 — Context Engine & Multi-File Support  
**Epic:** Epic 11 — Context Interface  
**Goal:** Define the interface for context extractors with support for priority-based context inclusion.

**Acceptance Criteria:**

- Context provider interface defined with priority scoring
- Context chunk types defined (file, recent, import, definition)
- Context budget constraints defined
- Context serialization format defined
