# Active Task

## Sprint 1 — Foundation & Infrastructure

**Active focus:** Setting up the monorepo structure, build tooling, and VS Code extension skeleton. This is the foundation for all subsequent development.

### Scope
- Initialize pnpm workspace monorepo
- Configure TypeScript and build tooling
- Create VS Code extension package skeleton
- Set up testing framework
- Create CI/CD configuration

### Out of Scope
- Completion engine logic
- Provider implementations
- UI components
- Performance optimization

### Progress
- [ ] LC-001: Initialize Monorepo Structure
- [ ] LC-002: Configure Build Tooling
- [ ] LC-003: Create VS Code Extension Skeleton
- [ ] LC-004: Set Up Vitest Testing
- [ ] LC-005: Create Test Fixtures and Mocks
- [ ] LC-006: Configure CI Pipeline

### Next Ticket
**LC-001: Initialize Monorepo Structure**

Create the pnpm workspace monorepo structure with packages for extension, core, and shared utilities. Set up package.json, pnpm-workspace.yaml, and tsconfig.base.json.

**Acceptance Criteria:**
- pnpm-workspace.yaml configured with packages/*
- Root package.json with workspace scripts
- tsconfig.base.json with shared TypeScript config
- packages/extension, packages/core, packages/shared directories exist
