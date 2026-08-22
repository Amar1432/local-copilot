# Architectural Decisions

This file records architectural decisions made during the project. New entries are prepended.

---

## 2024-01-01: Monorepo with pnpm Workspaces

**Decision:** Use pnpm workspaces for monorepo management.

**Alternatives:**
- npm workspaces
- Yarn workspaces
- Turborepo
- Nx

**Rationale:**
- pnpm is fast and efficient with disk space
- Native workspace support without extra tooling
- Strong TypeScript support
- Good ecosystem compatibility

**Consequences:**
- Requires pnpm installed globally
- Some VS Code extensions may need configuration
- Build commands need workspace-aware syntax

---

## 2024-01-01: TypeScript for All Packages

**Decision:** Use TypeScript for all packages with shared base configuration.

**Alternatives:**
- JavaScript with JSDoc
- Mixed TypeScript/JavaScript

**Rationale:**
- Type safety prevents many bugs
- Better IDE support and refactoring
- Consistent codebase
- Shared types between packages

**Consequences:**
- Build step required
- Learning curve for contributors unfamiliar with TypeScript
- Slightly more complex setup

---

## 2024-01-01: VS Code Extension API Only

**Decision:** Use only stable VS Code Extension APIs for MVP.

**Alternatives:**
- Proposed APIs
- Custom webview UIs
- Language Server Protocol

**Rationale:**
- Stability and compatibility
- No experimental API risks
- Simpler implementation
- Better user experience

**Consequences:**
- Limited to available APIs
- May need to implement workarounds for some features
- No custom webview UIs for MVP

---

## 2024-01-01: Fetch API for HTTP

**Decision:** Use native Fetch API for provider HTTP requests.

**Alternatives:**
- axios
- node-fetch
- got
- undici

**Rationale:**
- No external dependencies
- Native AbortController support
- Modern and well-supported
- Smaller bundle size

**Consequences:**
- No built-in retry logic
- Need to implement error handling manually
- Less feature-rich than some alternatives

---

## 2024-01-01: Vitest for Testing

**Decision:** Use Vitest as the testing framework.

**Alternatives:**
- Jest
- Mocha
- AVA

**Rationale:**
- Fast execution
- Native TypeScript support
- Compatible with Vite ecosystem
- Good IDE integration

**Consequences:**
- Some Jest plugins may not work
- Different configuration format
- Smaller community than Jest

---

## 2024-01-01: No Persistent Code Storage

**Decision:** Do not persist source code to disk in MVP.

**Alternatives:**
- SQLite for context cache
- File system cache
- IndexedDB

**Rationale:**
- Privacy first approach
- Simpler implementation
- No disk space concerns
- No security risks from stored code

**Consequences:**
- Context must be rebuilt on each session
- No offline history
- Simpler cache invalidation

---

## 2024-01-01: Non-Streaming for MVP

**Decision:** Use non-streaming completion for MVP.

**Alternatives:**
- Streaming with partial display
- Streaming with buffering
- Adaptive streaming

**Rationale:**
- Simpler implementation
- No flicker or unstable partial results
- Sufficient for small completions
- Easier to cancel

**Consequences:**
- Slightly higher perceived latency
- No progressive display
- Simpler error handling

---

## 2024-01-01: Local-Only Mode Default

**Decision:** Default to local-only mode for new installations.

**Alternatives:**
- Cloud enabled by default
- User choice on first run

**Rationale:**
- Privacy by default
- No accidental data leakage
- Aligns with product positioning
- Users can opt-in to cloud

**Consequences:**
- Users must configure cloud manually
- May confuse users expecting cloud
- Extra configuration step for cloud users

---

*Prepend new decisions above this line*
