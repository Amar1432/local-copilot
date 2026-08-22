# Documentation Reading Order

**Humans AND agents MUST read these docs in this exact order before modifying code.**

## Reading Order

1. **`graphify-out/GRAPH_REPORT.md`** — Codebase knowledge graph, community structure, and god nodes
2. **`PRD.md`** — Product requirements, user stories, acceptance criteria
3. **`ARCHITECTURE.md`** — System design, component responsibilities, data flows
4. **`API.md`** — Provider interfaces, VS Code extension APIs, configuration schema
5. **`docs/DESIGN_SYSTEM.md`** — UI guidelines, component patterns, accessibility
6. **`docs/DEPLOYMENT.md`** — Build commands, environment setup, troubleshooting
7. **`docs/ACTIVE_TASK.md`** — Current focus and progress
8. **`docs/HANDOFF.md`** — Session history and changes
9. **`DECISIONS.md`** — Architectural decisions and rationale

## Why This Order?

1. **Knowledge Graph first** — Understand the actual code topology and module clusters
2. **PRD.md second** — Understand what we're building and why
3. **Architecture third** — Understand how components fit together
4. **API fourth** — Understand the contracts and interfaces
5. **Design System fifth** — Understand UI requirements and patterns
6. **Deployment sixth** — Understand how to build and run
7. **Active Task seventh** — Understand what to work on now
8. **Handoff eighth** — Understand recent changes and context
9. **Decisions last** — Understand past architectural choices

## For New Contributors

If you're new to the project, read all documentation before making any changes. This ensures:

- You understand the product goals
- You follow architectural patterns
- You maintain API contracts
- You respect design principles
- You can build and test your changes

## For Existing Contributors

At minimum, read:

- `docs/ACTIVE_TASK.md` — Know what you're working on
- `AI.md` — Know the workflow and conventions
- Any docs related to your ticket scope

## Document Maintenance

- Keep docs concise and up-to-date
- Archive outdated content to `docs/archive/`
- Update this index if adding new docs
- Remove references to deleted docs
