# Design System

## Design Principles

### 1. Invisible Integration

The extension should feel like a natural part of VS Code, not a separate tool. Completions appear seamlessly without disrupting the developer's flow.

### 2. Information Density

Status indicators and diagnostics should convey maximum information in minimum space. Use VS Code's native UI patterns.

### 3. Privacy Transparency

Always make it clear what mode the extension is in (local/cloud) and what data is being sent.

## Color Palette

### Status Colors

| State             | Color                      | Usage                           |
| ----------------- | -------------------------- | ------------------------------- |
| Connected (Local) | `#4EC9B0` (VS Code green)  | Status bar, connected indicator |
| Connected (Cloud) | `#569CD6` (VS Code blue)   | Status bar, cloud indicator     |
| Disconnected      | `#F44747` (VS Code red)    | Error states                    |
| Warning           | `#CCA700` (VS Code yellow) | Rate limits, warnings           |
| Disabled          | `#808080` (Gray)           | Disabled states                 |

### Semantic Colors

| Element                      | Color Source                     |
| ---------------------------- | -------------------------------- |
| Inline completion ghost text | `editorSuggestWidget.foreground` |
| Status bar item              | `statusBar.foreground`           |
| Error messages               | `notifications.foreground`       |
| Diagnostics panel            | `editor.background`              |

## Typography

### Status Bar

- Font: Inherit from VS Code status bar
- Size: Default status bar size
- Weight: Normal (400)

### Diagnostics View

- Font: Inherit from VS Code editor
- Monospace for code/technical values
- Regular for labels

### Inline Completions

- Font: Inherit from editor font
- Size: Inherit from editor font size
- Weight: Inherit from editor

## Spacing

### Status Bar Item

- Use VS Code's default status bar spacing
- Maximum 2 items to avoid clutter

### Diagnostics Panel

- Follow VS Code's webview padding conventions
- Section spacing: 16px
- Item spacing: 8px

## Components

### Status Bar Item

```
┌─────────────────┐
│ AI: Local │
└─────────────────┘
```

States:

- `AI: Local` — Local provider connected
- `AI: Cloud` — Cloud provider connected
- `AI: Offline` — No connection
- `AI: Local Only` — Local-only mode enabled

Click behavior: Opens status panel or configuration quick pick

### Inline Completion

Standard VS Code ghost text behavior:

- Renders in `editorGhostText.foreground`
- No custom rendering
- Standard keybindings for accept/dismiss

### Diagnostics Panel

```
┌─────────────────────────────────────┐
│ Private Copilot Diagnostics │
├─────────────────────────────────────┤
│ Extension: 0.1.0 │
│ Provider: Ollama │
│ Model: qwen-coder │
│ Status: Connected │
│ Latency: 182ms │
├─────────────────────────────────────┤
│ Last Request │
│ Status: Success │
│ Tokens: 48 │
│ Cached: No │
├─────────────────────────────────────┤
│ Cache Stats │
│ Hits: 21 │
│ Misses: 47 │
└─────────────────────────────────────┘
```

### Quick Pick — Model Selection

```
┌─────────────────────────────────────┐
│ Select Model │
├─────────────────────────────────────┤
│ ● qwen-coder │
│ local │
│ FIM │
├─────────────────────────────────────┤
│ ● deepseek-coder │
│ local │
│ FIM │
├─────────────────────────────────────┤
│ ● gpt-4 │
│ remote │
│ No FIM │
└─────────────────────────────────────┘
```

### Command Palette Commands

```
Private Copilot: Enable
Private Copilot: Disable
Private Copilot: Trigger Completion
Private Copilot: Select Model
Private Copilot: Select Provider
Private Copilot: Test Connection
Private Copilot: Show Diagnostics
Private Copilot: Clear Cache
Private Copilot: Open Settings
```

## Accessibility

### Keyboard Navigation

- All commands accessible via Command Palette
- Status bar item keyboard accessible
- Quick pick supports standard VS Code keyboard navigation

### Screen Reader Support

- Status bar item has aria-label
- Diagnostics panel uses semantic HTML
- Error messages are descriptive

### Color Independence

- Status is conveyed through text, not just color
- Connection state uses icons + text
- Error states use text descriptions

## Animations

### Minimal by Design

- No custom animations for MVP
- Rely on VS Code's built-in transitions
- Ghost text appears/disappears instantly
- Status updates are immediate

### Future Considerations

- Subtle pulse animation for "processing" state
- Fade-in for status changes
- Progress indicator for slow operations

## Responsive Design

### Status Bar

- Single line, maximum 2 items
- Text truncation for long provider names
- Tooltip for full details

### Diagnostics Panel

- Scrollable for long content
- Monospace for technical values
- Responsive to panel width

## Component Guidelines

### Do

- Use VS Code's native UI patterns
- Keep status indicators minimal
- Provide descriptive error messages
- Support keyboard-first interaction

### Don't

- Create custom webview UIs for MVP
- Add unnecessary visual effects
- Override VS Code's default styling
- Create complex custom components

## Iconography

### Status Icons

- Use VS Code's built-in codicon set
- No custom icons for MVP
- Standard icons for connection states

### Future Icons

- Provider-specific icons
- Model capability indicators
- Quality metric badges

## Dark/Light Theme Support

### Automatic Theming

- All colors use VS Code theme variables
- No hardcoded colors
- Automatic adaptation to light/dark themes
- High contrast support through theme variables
