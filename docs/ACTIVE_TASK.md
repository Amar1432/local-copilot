# Active Task

## Sprint 3 — Provider Abstraction & Local Provider

**Active focus:** Defining the completion provider interface, implementing the provider router, OpenAI-compatible provider adapter with FIM and model discovery, and secret management.

### Scope

- CompletionProvider interface and capability contracts in `@local-copilot/core`
- Provider Router for selecting and switching providers dynamically
- OpenAI-Compatible provider with streaming/non-streaming support
- Fill-in-the-Middle (FIM) prompt formatting support
- Model discovery (`/v1/models`) integration
- SecretStorage integration and local-only privacy enforcement

### Out of Scope

- Multi-file repository context (Sprint 4)
- Webview UI or advanced diagnostics view (Sprint 5)

### Progress

- [x] LC-014: Define CompletionProvider Interface
- [x] LC-015: Implement Provider Router
- [x] LC-016: Implement OpenAI-Compatible Provider
- [x] LC-017: Implement FIM Support
- [ ] LC-018: Implement Model Discovery
- [ ] LC-019: Implement SecretStorage Integration
- [ ] LC-020: Implement Local-Only Mode

---

### Next Ticket: **LC-018: Implement Model Discovery**

**Sprint:** Sprint 3 — Provider Abstraction & Local Provider  
**Epic:** Epic 8 — OpenAI-Compatible Provider  
**Goal:** Add optional model listing via GET /v1/models endpoint for providers that support it.

**Acceptance Criteria:**

- Provider attempts model discovery on connection
- Model list is cached and refreshable
- Model list fallback allows manual entry
- Model capabilities are extracted from metadata
