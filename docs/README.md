# Documentation Reading Order

**Humans AND agents MUST read these docs in this exact order before modifying code.**

## Reading Order

1. **`PRD.md`** — Product requirements, user stories, acceptance criteria
2. **`ARCHITECTURE.md`** — System design, component responsibilities, data flows
3. **`API.md`** — Provider interfaces, VS Code extension APIs, configuration schema
4. **`docs/DESIGN_SYSTEM.md`** — UI guidelines, component patterns, accessibility
5. **`docs/DEPLOYMENT.md`** — Build commands, environment setup, troubleshooting
6. **`docs/ACTIVE_TASK.md`** — Current focus and progress
7. **`docs/HANDOFF.md`** — Session history and changes
8. **`DECISIONS.md`** — Architectural decisions and rationale

## Why This Order?

1. **PRD.md first** — Understand what we're building and why
2. **Architecture second** — Understand how components fit together
3. **API third** — Understand the contracts and interfaces
4. **Design System fourth** — Understand UI requirements and patterns
5. **Deployment fifth** — Understand how to build and run
6. **Active Task sixth** — Understand what to work on now
7. **Handoff seventh** — Understand recent changes and context
8. **Decisions last** — Understand past architectural choices

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
