# AI.md — Single Source of Truth for Agents

## 1. Project Workflow

**Do not ideate or guess.** Only work the active ticket. Always update HANDOFF.md before ending a session.

### Workflow Steps

1. Consult `graphify-out/GRAPH_REPORT.md` and read docs in mandatory order (see Reading Order below)
2. Work ONLY the ticket named in `docs/ACTIVE_TASK.md`
3. Implement changes
4. Run build/lint/tests until green
5. Run `graphify update .` to update the knowledge graph
6. Commit with ticket ID: `feat|fix|test|chore(scope): [<TICKET_ID>] <message>`
7. Prepend entry to `docs/HANDOFF.md` (newest on top, immediately below the Project State Summary header)
8. Update `docs/ACTIVE_TASK.md` to next ticket

### Scope Discipline

- Changes MUST be confined to the assigned ticket
- No out-of-scope refactoring
- No "while I'm here" improvements
- If you discover issues, note them in `DECISIONS.md` for future tickets

## 2. Environment & Startup

### Prerequisites

- Node.js 18+
- pnpm 8+
- Python 3 / graphifyy (for knowledge graph generation)
- VS Code (for testing)

### Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build and watch
pnpm dev

# Run tests
pnpm test

# Run linter
pnpm lint

# Type check
pnpm typecheck

# Package extension
pnpm package

# Update Graphify knowledge graph
graphify update .

# Query Graphify knowledge graph
graphify query "<question>"
```

### Package-Specific Commands

```bash
# Build extension only
pnpm --filter @local-copilot/extension build

# Test extension
pnpm --filter @local-copilot/extension test

# Build core
pnpm --filter @local-copilot/core build
```

## 3. Reading Order

**Humans AND agents MUST read docs in this exact order before modifying code:**

1. `graphify-out/GRAPH_REPORT.md` — Codebase knowledge graph, community structure, and god nodes
2. `PRD.md` — Product requirements
3. `ARCHITECTURE.md` — System design
4. `API.md` — Provider interfaces and contracts
5. `docs/DESIGN_SYSTEM.md` — UI guidelines
6. `docs/DEPLOYMENT.md` — Build and deployment
7. `docs/ACTIVE_TASK.md` — Current focus
8. `docs/HANDOFF.md` — Session history
9. `DECISIONS.md` — Architectural decisions

## 4. Architecture & Coding Conventions

### TypeScript

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use readonly where possible
- Avoid `any` type
- Use async/await over raw promises

### Naming Conventions

- Files: `kebab-case.ts` (e.g., `completion-orchestrator.ts`)
- Types/Interfaces: `PascalCase` (e.g., `CompletionRequest`)
- Functions: `camelCase` (e.g., `buildContext`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_CONTEXT_LINES`)
- Classes: `PascalCase` (e.g., `ProviderRouter`)

### File Structure

- One export per file preferred
- Group by feature/domain
- Co-locate tests with source files
- Use index.ts for barrel exports

### Error Handling

- Use custom error classes for domain errors
- Always handle errors at the orchestrator level
- Log errors with context, never log secrets
- Provide user-facing messages via status/diagnostics

### Testing

- Write tests for all new features
- Mock external dependencies
- Use descriptive test names
- Test edge cases and error paths

### Performance

- Never block the main thread
- Use async operations for I/O
- Implement cancellation for long operations
- Cache expensive computations

## 5. Git & Execution Rules

### Commit Messages

Format: `type(scope): [<TICKET_ID>] Description`

Types:

- `feat` — New feature
- `fix` — Bug fix
- `test` — Adding tests
- `chore` — Maintenance
- `docs` — Documentation
- `refactor` — Code refactoring

Examples:

```
feat(context): [LC-021] Implement basic context extraction
fix(scheduler): [LC-010] Fix cancellation race condition
test(provider): [LC-016] Add OpenAI provider tests
```

### Branch Naming

- `feature/<ticket-id>-<short-description>`
- `fix/<ticket-id>-<short-description>`
- `chore/<description>`

### Before Claiming Done

1. Run `pnpm build` — must succeed
2. Run `pnpm lint` — must pass
3. Run `pnpm test` — must pass
4. Verify no TypeScript errors
5. Run `graphify update .` — keep knowledge graph synchronized
6. Test in VS Code (if UI changes)

### Documentation Updates

- Update `HANDOFF.md` with session summary prepended at the top (newest first, directly under Project State Summary)
- Update `ACTIVE_TASK.md` with progress
- Add decisions to `DECISIONS.md` if made
- Update any affected documentation

## 6. Agent Session Protocol

### Starting a Session

1. Read `AI.md` (this file)
2. Consult `graphify-out/GRAPH_REPORT.md` (and use Graphify tools/MCP if available for architecture queries)
3. Read `docs/ACTIVE_TASK.md` for current ticket
4. Read relevant documentation based on ticket scope
5. Understand the acceptance criteria before coding

### During a Session

1. Work only on the assigned ticket
2. Make small, incremental changes
3. Test frequently
4. Commit after each logical unit of work

### Ending a Session

1. Ensure all changes compile and tests pass
2. Run `graphify update .`
3. Commit with proper message format
4. Prepend entry to `docs/HANDOFF.md` (newest on top, immediately below Project State Summary)
5. Update `docs/ACTIVE_TASK.md`
6. Do NOT leave partially completed work

### Self-Maintenance

- If docs grow unwieldy, archive to `docs/archive/`
- Keep `ACTIVE_TASK.md` concise
- Prune old entries from `HANDOFF.md` when archiving
