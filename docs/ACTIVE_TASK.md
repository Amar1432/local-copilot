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
- [ ] LC-015: Implement Provider Router
- [ ] LC-016: Implement OpenAI-Compatible Provider
- [ ] LC-017: Implement FIM Support
- [ ] LC-018: Implement Model Discovery
- [ ] LC-019: Implement SecretStorage Integration
- [ ] LC-020: Implement Local-Only Mode

---

### Next Ticket: **LC-015: Implement Provider Router**

**Sprint:** Sprint 3 — Provider Abstraction & Local Provider  
**Epic:** Epic 7 — Provider Interface  
**Goal:** Create a router that selects the appropriate provider based on configuration and manages provider lifecycle.

**Acceptance Criteria:**

- Router selects provider from configuration
- Router validates provider configuration
- Router handles provider failures gracefully
- Router supports provider switching
