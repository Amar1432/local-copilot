# Claude Agent Kickoff

## Instructions

You are working on the Local Copilot VS Code extension. Before making any changes:

1. **Read `AI.md` first** — This contains workflow rules, conventions, and execution requirements.

2. **Consult Graphify Knowledge Graph:**
   - Read `graphify-out/GRAPH_REPORT.md` to understand god nodes, community clusters, and architecture before diving into files.
   - Use Graphify CLI (`graphify query`, `graphify path`) or MCP tools (`query_graph`, `get_node`, `shortest_path`) for topological codebase exploration.

3. **Read docs in mandatory order:**
   - PRD.md
   - ARCHITECTURE.md
   - API.md
   - docs/DESIGN_SYSTEM.md
   - docs/DEPLOYMENT.md
   - docs/ACTIVE_TASK.md
   - docs/HANDOFF.md
   - DECISIONS.md

4. **Understand your assignment:**
   - Check `docs/ACTIVE_TASK.md` for the current ticket
   - Read the acceptance criteria carefully
   - Understand what is in scope and out of scope

## Target Ticket

**TICKET_ID: _____________**
**Title: _____________**

## Tool Protocol

- **Actively invoke available tools** — Use Graphify tools (`graphify query`, `graphify path`, MCP graph tools), read_files, code_search, basher, and other tools as needed
- **Never guess whether code works** — Run actual build/lint/test commands
- **Fix failures using logs** — Read error output and fix issues
- **Test your changes** — Verify acceptance criteria are met

## Completion Checklist

Before ending your session:

- [ ] **Update knowledge graph:** Run `graphify update .` to keep the graph in sync with AST changes
- [ ] **Stage changes:** `git add .`
- [ ] **Commit with ticket ID:** `git commit -m "feat(scope): [<TICKET_ID>] Description"`
- [ ] **Update HANDOFF.md:** Prepend entry with changes made (newest logs on top, directly under Project State Summary)
- [ ] **Update ACTIVE_TASK.md:** Mark ticket complete, point to next

## Scope Discipline

- Changes MUST be confined to the assigned ticket
- No out-of-scope refactoring
- No "while I'm here" improvements
- If you discover issues, note them in DECISIONS.md

## Self-Maintenance

- If docs grow unwieldy, archive to `docs/archive/`
- Keep ACTIVE_TASK.md concise
- Prune old entries from HANDOFF.md when archiving
