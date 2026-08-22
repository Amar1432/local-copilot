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

- [x] LC-001: Initialize Monorepo Structure
- [x] LC-002: Configure Build Tooling
- [x] LC-003: Create VS Code Extension Skeleton
- [x] LC-004: Set Up Vitest Testing
- [ ] LC-005: Create Test Fixtures and Mocks
- [ ] LC-006: Configure CI Pipeline

### Next Ticket**LC-005: Create Test Fixtures and Mocks**

Build reusable test fixtures, mock factories, and test utilities for provider and context testing.

**Acceptance Criteria:**
- Mock factories for VS Code APIs exist
- Test fixtures for completion scenarios exist
- Test utilities reduce boilerplate in test files
- All existing tests still pass
