# Changelog

All notable changes to Private Copilot will be documented in this file.

## [0.1.3] — 2026-08-23

### Changed

- **Full rebrand: Local Copilot → Private Copilot** — Renamed all remaining `Local Copilot` references to `Private Copilot` across the entire project, including npm packages (`@local-copilot/*` → `@private-copilot/*`), TypeScript imports, VS Code settings namespace, command IDs, display names, documentation, and repository URLs.

### Fixed

- **Duplicate completion suppression for multi-line suggestions** — The `isCompletionAlreadyPresent` guard only scanned 10 lines back from the cursor. Multi-line completions (e.g. a 16-line function) were not detected as duplicates after acceptance because the lookback window didn't reach far enough. Now scans all text from the document start up to the cursor position, preventing the repeating-ghost-text loop.

## [0.1.2] — 2026-08-23

### Added

- Documentation & VSIX packaging (LC-038)
- Performance optimization & latency profiling (LC-037)
- Online metrics & privacy telemetry (LC-036)
- Benchmark tooling (LC-035)
- Diagnostics command improvements (LC-034)
- Setup wizard command (LC-033)
- Toggle command & quick settings (LC-032)
- Expanded language support — Python, Go, Rust, Java, C, C++ (LC-031)
- Completion metrics tracker (LC-030)
- Status bar enhancements (LC-029)
- Webview diagnostics panel (LC-028)

## [0.1.1] — 2026-08-23

### Changed

- Updated extension branding and publisher to private-copilot
- Migrated all commands, settings, and documentation to private-copilot
- Updated repository and CDN URLs

## [0.1.0] — 2026-08-22

### Added

- Initial release with core completion engine (LC-001 through LC-027)
- Provider router with OpenAI-compatible and FIM support
- Context engine with multi-file deduplication and budgeting
- Request caching, debouncing, and cancellation
- SecretStorage API key management
- Setup wizard and diagnostics panel
