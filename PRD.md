# PRD.md — Local AI Autocomplete for VS Code

**Product Name:** Local Copilot (working title)  
**Document Version:** 1.0  
**Status:** Draft / MVP Definition  
**Platform:** Visual Studio Code Extension  
**Primary Goal:** Fast, accurate, privacy-conscious code autocomplete powered by local models or configurable cloud/OpenAI-compatible LLM endpoints.

---

## 1. Product Overview

Local Copilot is a VS Code extension that provides AI-powered inline code completion and code suggestions while a developer is typing.

The product is designed around one core principle:

> **Autocomplete should feel local, instant, predictable, and developer-controlled, while still allowing stronger cloud models when the user chooses them.**

The extension must support:

- Fully local inference through local AI runtimes.
- Cloud inference through configurable providers.
- OpenAI-compatible APIs using configurable `baseUrl` and `apiKey`.
- Multiple models/providers with per-language or per-workspace configuration.
- Streaming or low-latency completion responses where supported.
- Strong context selection so only useful code is sent to the model.
- Aggressive cancellation, caching, debouncing, and request deduplication.
- Privacy controls that make it clear what code leaves the machine.
- Evaluation tooling to measure completion latency, acceptance rate, relevance, and hallucination/error rate.

The extension should compete primarily on **latency, privacy, configurability, and practical coding accuracy**, rather than attempting to reproduce every feature of large coding assistants.

---

# 2. Problem Statement

Existing AI coding assistants often provide strong suggestions but introduce one or more of the following problems:

1. Cloud-only inference can create privacy concerns.
2. Network latency can make autocomplete feel sluggish.
3. Users may not be able to choose the model, endpoint, or provider.
4. Some assistants send more context than necessary.
5. Local models are difficult to integrate into a smooth IDE workflow.
6. Users may want a single interface for local and cloud models.
7. Developers need predictable configuration for enterprise, self-hosted, or private deployments.
8. Generic chat-oriented LLMs are not necessarily optimized for inline completion.
9. AI autocomplete can become distracting when suggestions appear too frequently or are low quality.

The product should solve this by building a **dedicated autocomplete pipeline**, rather than simply sending the current file to a generic chat endpoint.

---

# 3. Product Vision

Create a developer-controlled AI completion layer for VS Code where the user can choose:

- **Where inference happens**
- **Which model is used**
- **Which context is shared**
- **How aggressive suggestions should be**
- **How latency-sensitive the system should be**
- **How much telemetry is collected**

The ideal experience:

> The developer types a few characters, pauses naturally, and receives a highly relevant completion within a fraction of a second when possible. Local models require no network access. Cloud models can be enabled with a custom endpoint and API key. The system automatically cancels stale requests and avoids unnecessary work.

---

# 4. Goals

## 4.1 Primary Goals

### G1 — Extremely Fast Autocomplete

The extension should optimize for perceived responsiveness.

Target:

- Local fast-path suggestion: **<150 ms P50**
- Local model completion: **<300 ms P50**, hardware/model dependent
- Cloud completion: **<500 ms P50** under normal network conditions
- Completion request cancellation: **<50 ms** after a newer edit when technically possible
- No blocking of VS Code's main UI thread

These are engineering targets, not guarantees.

### G2 — High Completion Relevance

Suggestions should:

- Match the programming language.
- Respect surrounding syntax.
- Use nearby symbols and imports.
- Continue the developer's existing coding pattern.
- Avoid inventing unrelated APIs.
- Prefer minimal useful completions.
- Avoid unnecessarily repeating already-written text.

### G3 — Local-First Privacy

The system must make local inference a first-class experience.

Users should be able to configure:

- Local model endpoint.
- Local model name.
- Local embedding/model services where applicable.
- Whether source code can ever leave the machine.

A **local-only mode** must exist.

### G4 — Provider Agnostic Architecture

The core autocomplete engine must not depend on one vendor.

Supported provider classes:

- Local OpenAI-compatible server.
- Generic OpenAI-compatible cloud endpoint.
- OpenAI.
- Ollama-compatible endpoint.
- LM Studio-compatible endpoint.
- vLLM-compatible endpoint.
- Other custom providers through the provider interface.

### G5 — Developer Control

Users should be able to configure:

- Provider.
- Model.
- Base URL.
- API key.
- Temperature / sampling settings where supported.
- Max tokens.
- Timeout.
- Debounce delay.
- Context limits.
- Enabled languages.
- Suggestion frequency.
- Local-only mode.
- Telemetry.
- Workspace overrides.

### G6 — Measurable Quality

The product must include an evaluation framework that measures:

- Suggestion latency.
- Acceptance rate.
- Completion length.
- Prefix accuracy.
- Syntax validity.
- Build/test impact where measurable.
- User rejection rate.
- Duplicate suggestion rate.
- Model/provider comparison.

---

# 5. Non-Goals for MVP

The MVP will **not** attempt to provide:

- Full AI chat assistant.
- Autonomous coding agents.
- Automatic multi-file refactoring.
- Full repository-wide reasoning on every keystroke.
- Git commit generation.
- PR review.
- Terminal automation.
- Browser automation.
- Voice coding.
- Fully autonomous code generation.

These may be added later.

---

# 6. Target Users

## 6.1 Primary User

Software developers using VS Code who want AI autocomplete with greater control over inference and privacy.

Examples:

- JavaScript/TypeScript developers.
- Python developers.
- Java developers.
- Go developers.
- Rust developers.
- C/C++ developers.
- Full-stack developers.
- Developers working on proprietary code.
- Developers running local models.
- Developers using self-hosted inference.

## 6.2 Secondary Users

- Developers experimenting with local LLMs.
- AI/ML engineers evaluating coding models.
- Enterprises using private inference servers.
- Teams wanting an internal coding assistant.
- Students and hobbyists wanting offline AI assistance.

---

# 7. Core User Stories

### US-01 — Local Autocomplete

As a developer, I want autocomplete to use my local AI model so that source code never leaves my machine.

### US-02 — Cloud Autocomplete

As a developer, I want to configure a cloud LLM endpoint so that I can use stronger models when appropriate.

### US-03 — Custom Endpoint

As a developer, I want to configure a custom `baseUrl` and API key so that I can connect to self-hosted or OpenAI-compatible services.

### US-04 — Model Selection

As a developer, I want to choose which model generates completions.

### US-05 — Fast Suggestions

As a developer, I want suggestions to appear quickly enough that typing does not feel interrupted.

### US-06 — Automatic Cancellation

As a developer, I want stale requests cancelled when I continue typing.

### US-07 — Context Awareness

As a developer, I want suggestions to consider my current function, imports, nearby symbols, file structure, and language.

### US-08 — Workspace Configuration

As a developer, I want different models/providers per project.

### US-09 — Offline Mode

As a developer, I want a guaranteed local-only mode that never makes remote requests.

### US-10 — Transparent Privacy

As a developer, I want to know exactly what context is sent to an external model.

---

# 8. Product Principles

## 8.1 Latency Over Completeness

A short relevant completion delivered quickly is better than a long perfect completion delivered too late.

## 8.2 Context Should Be Selective

Do not send the entire repository by default.

Context should be selected based on relevance.

## 8.3 Cancel Aggressively

Never keep computing a completion for a document state the user has already changed.

## 8.4 Local-First

Local inference must not be a second-class integration.

## 8.5 Deterministic Where Possible

Autocomplete should be more predictable than chat.

Default sampling should favor low variance.

## 8.6 User Control

Configuration must remain understandable and reversible.

---

# 9. High-Level Architecture

```text
+-------------------------------------------------------+
|                    VS Code Extension                  |
|                                                       |
|  +----------------+    +----------------------------+ |
|  | Editor Events  | -> | Completion Orchestrator     | |
|  +----------------+    +-------------+--------------+ |
|                                      |                |
|                                      v                |
|                         +--------------------------+  |
|                         | Request Scheduler        |  |
|                         | - Debounce              |  |
|                         | - Cancellation          |  |
|                         | - Deduplication         |  |
|                         +------------+-------------+  |
|                                      |                |
|                                      v                |
|                         +--------------------------+  |
|                         | Context Engine           |  |
|                         | - Prefix                 |  |
|                         | - Suffix                 |  |
|                         | - Current function       |  |
|                         | - Imports                |  |
|                         | - Symbols                |  |
|                         | - Relevant files        |  |
|                         +------------+-------------+  |
|                                      |                |
|                                      v                |
|                         +--------------------------+  |
|                         | Prompt / Input Builder   |  |
|                         +------------+-------------+  |
|                                      |                |
|                                      v                |
|                         +--------------------------+  |
|                         | Provider Router          |  |
|                         +------+-------------------+  |
|                                |                    |
|                  +-------------+-------------+      |
|                  |                           |      |
|                  v                           v      |
|        +--------------------+      +------------------+
|        | Local Provider     |      | Cloud Provider   |
|        | Ollama/LM Studio   |      | OpenAI/custom    |
|        | vLLM/etc.          |      | OpenAI-compatible|
|        +---------+----------+      +---------+--------+
|                  |                           |
|                  +-------------+-------------+
|                                |
|                                v
|                    +-------------------------+
|                    | Completion Normalizer    |
|                    +-----------+-------------+
|                                |
|                                v
|                    +-------------------------+
|                    | Inline Suggestion UI     |
|                    +-------------------------+
+-------------------------------------------------------+
```

---

# 10. Core Components

## 10.1 VS Code Extension Host

Responsibilities:

- Register `InlineCompletionItemProvider`.
- Listen to editor changes.
- Detect completion opportunities.
- Read editor state.
- Manage workspace configuration.
- Display inline completions.
- Maintain lifecycle and cancellation.

Important constraint:

**Avoid CPU-heavy processing on the extension's critical interaction path.**

---

# 11. Completion Orchestrator

The Completion Orchestrator is the central coordinator.

Responsibilities:

1. Receive an editor completion request.
2. Determine if the request should be processed.
3. Check caches.
4. Build relevant context.
5. Select provider/model.
6. Execute request.
7. Cancel stale work.
8. Normalize the model output.
9. Return a valid VS Code completion.

Pseudo-flow:

```text
Editor Change
     |
     v
Should Suggest?
     |
    Yes
     |
     v
Debounce
     |
     v
Compute Request Fingerprint
     |
     +---- Cache Hit ------> Return
     |
     v
Build Context
     |
     v
Build Completion Prompt
     |
     v
Select Provider
     |
     v
Send Request
     |
     +---- Cancelled -----> Drop Result
     |
     v
Validate / Normalize
     |
     v
Return Inline Completion
```

---

# 12. Request Scheduler

The scheduler is one of the most important performance components.

## Required Features

### Debouncing

Do not call the model on every keystroke.

Default:

```text
debounceMs = 100-200
```

The extension should make this configurable.

### Cancellation

Every request should have an `AbortController` or equivalent cancellation primitive.

When a newer document version arrives:

```text
request(version=N) -> cancelled
request(version=N+1) -> active
```

### Request Versioning

Every completion request should include:

- Document URI
- Document version
- Cursor position
- Request ID
- Provider ID
- Model ID

A response belonging to an old document version must never be inserted into the editor.

### Deduplication

If identical input is submitted repeatedly:

```text
hash(documentVersion, position, prefix, suffix, config)
```

The same in-flight request should be reused where safe.

---

# 13. Context Engine

The context engine determines what information should be sent to the model.

This is critical for both accuracy and latency.

## 13.1 Immediate Context

Always consider:

- Current line.
- Lines above cursor.
- Lines below cursor.
- Current block.
- Current function/method.
- Current class/component.

The primary completion region should be centered around:

```text
cursor position
    +
prefix
    +
suffix
```

---

## 13.2 Syntax Context

Where available, use VS Code's language services or parsing infrastructure to identify:

- Current function.
- Current class.
- Imports.
- Variables.
- Types/interfaces.
- Symbols.
- Comments.
- JSX/TSX boundaries.
- String/template contexts.

Do not initially build a custom parser for every language.

Prefer:

1. VS Code document APIs.
2. Language server information.
3. Tree-sitter or language-specific parsers only where necessary.

---

# 14. Repository Context

Repository-wide context should be optional.

MVP should support lightweight relevant context.

Potential sources:

- Current file.
- Imported files.
- Nearby project files.
- Symbol definitions.
- Type definitions.
- Existing implementations.
- Configuration files.

Avoid blindly injecting an entire repository.

---

# 15. Context Ranking

When multiple files are eligible, rank them.

Suggested scoring:

```text
score =
    importRelationship * 0.30
  + symbolRelationship * 0.25
  + pathSimilarity * 0.15
  + languageMatch * 0.10
  + recentEditRecency * 0.10
  + lexicalSimilarity * 0.10
```

The exact formula should be tunable.

A later version may use embeddings or a lightweight reranker.

---

# 16. Prompt / Completion Input Strategy

Autocomplete prompts should be different from chat prompts.

The model should understand:

- Programming language.
- File path.
- Relevant code before cursor.
- Relevant code after cursor.
- Optional related context.
- Exact completion boundary.

Example conceptual format:

```text
You are a code completion engine.

Language: TypeScript
File: src/services/user.service.ts

Complete only the code at <CURSOR>.

Do not explain.
Do not repeat existing text.
Return only code that should be inserted.

<CONTEXT>
...relevant code...
</CONTEXT>

<PREFIX>
...code before cursor...
</PREFIX>

<SUFFIX>
...code after cursor...
</SUFFIX>

<COMPLETION>
```

Provider adapters may transform this format for different APIs/models.

---

# 17. Fill-in-the-Middle Support

Fill-in-the-middle (FIM) should be a first-class capability.

For models supporting FIM tokens or APIs, send:

```text
prefix + cursor + suffix
```

Conceptually:

```text
<PRE>prefix</PRE>
<FIM>
<SUF>suffix</SUF>
```

FIM is often preferable to asking a chat model to "continue the code".

The provider interface must advertise whether FIM is supported.

Example capability metadata:

```ts
interface ModelCapabilities {
  supportsStreaming: boolean;
  supportsFIM: boolean;
  supportsStopSequences: boolean;
  contextWindow: number;
  maxOutputTokens?: number;
}
```

---

# 18. Provider Abstraction

All model communication must go through a common provider interface.

Example:

```ts
interface CompletionProvider {
  id: string;

  validateConfig(config: ProviderConfig): Promise<void>;

  getModels(): Promise<ModelInfo[]>;

  complete(request: CompletionRequest, signal: AbortSignal): Promise<CompletionResponse>;
}
```

Possible provider types:

```text
LocalOpenAICompatible
Ollama
LMStudio
vLLM
OpenAI
CustomOpenAICompatible
```

---

# 19. Custom OpenAI-Compatible Provider

This is a core MVP feature.

Configuration example:

```json
{
  "provider": "custom",
  "baseUrl": "http://localhost:11434/v1",
  "apiKey": "local-key",
  "model": "qwen-coder"
}
```

The product should support endpoints such as:

```text
http://localhost:11434/v1
http://127.0.0.1:1234/v1
http://localhost:8000/v1
https://your-company-ai.example.com/v1
```

The API key should be optional for providers that do not require authentication.

---

# 20. Configuration Model

Example VS Code settings:

```json
{
  "localCopilot.enabled": true,

  "localCopilot.provider": "custom",

  "localCopilot.baseUrl": "http://localhost:11434/v1",

  "localCopilot.apiKey": "",

  "localCopilot.model": "qwen-coder",

  "localCopilot.debounceMs": 150,

  "localCopilot.requestTimeoutMs": 2000,

  "localCopilot.maxOutputTokens": 128,

  "localCopilot.temperature": 0.1,

  "localCopilot.context.maxLines": 120,

  "localCopilot.repositoryContext.enabled": false,

  "localCopilot.telemetry.enabled": false,

  "localCopilot.localOnly": true
}
```

Actual configuration IDs can change during implementation.

---

# 21. API Key Security

API keys must not be stored as plain text in arbitrary extension files.

Preferred implementation:

- VS Code SecretStorage.
- Never log secrets.
- Never include API keys in diagnostics.
- Mask credentials in errors.
- Do not send credentials to models except through required authentication mechanisms.
- Avoid putting secrets into generated prompt/context data.

For workspace settings:

- Store non-secret configuration in `.vscode/settings.json`.
- Store secrets through VS Code SecretStorage.

---

# 22. Local-Only Mode

When enabled:

```text
localCopilot.localOnly = true
```

The extension must reject all remote providers.

The following must be blocked:

- Remote model requests.
- Remote embeddings.
- Remote telemetry.
- Remote logging.

The user interface should clearly display:

```text
LOCAL ONLY
```

when enabled.

---

# 23. Completion Filtering

Raw model output should never be inserted blindly.

Validation stages:

1. Remove markdown code fences.
2. Remove explanatory prose.
3. Remove accidental prompt labels.
4. Remove duplicate prefix.
5. Remove duplicate suffix.
6. Validate insertion range.
7. Check language-specific obvious syntax issues where practical.
8. Check output length.
9. Check empty/whitespace-only results.
10. Check whether completion is substantially identical to existing code.

---

# 24. Suggestion Post-Processing

The normalizer should support:

### Prefix Deduplication

Input:

```text
const user = getU
```

Model:

```text
ser()
```

Final insertion:

```text
ser()
```

not:

```text
getUser()
```

unless the model output actually requires it.

### Suffix Awareness

If the suffix already contains `)`, do not generate duplicated closing syntax unnecessarily.

### Stop Sequences

Possible stop conditions:

```text
\n\n
<END>
```

Provider/model-specific behavior must be configurable.

---

# 25. Suggestion Trigger Strategy

The extension should not call the model for every cursor movement.

Potential trigger conditions:

### Trigger

- Character typed.
- After identifier completion.
- After `.`.
- After `(`.
- After `{`.
- After `=`.
- After `=>`.
- After `return`.
- After import-related tokens.
- After newline.

### Avoid Trigger

- Rapid continuous typing.
- Large paste operations.
- Undo/redo bursts.
- Inside binary/generated files.
- Very large documents unless supported.
- Comments/strings if configured to ignore them.
- Unsupported languages.

This should be configurable.

---

# 26. Language Support

MVP target languages:

1. TypeScript
2. JavaScript
3. TSX
4. JSX
5. Python
6. Java
7. Go
8. Rust
9. C++
10. C#

The architecture must allow any language supported by VS Code.

Language-specific prompt/context policies should be modular.

---

# 27. UI / UX

## 27.1 Inline Suggestion

Primary UX:

```text
const user = getUserById(
                         id)
```

Suggested text should render through VS Code inline completion APIs.

---

# 28. Keyboard Controls

Use standard VS Code conventions where possible:

- Accept inline suggestion.
- Dismiss suggestion.
- Next/previous suggestion.
- Trigger manually.

Avoid introducing unnecessary custom shortcuts.

---

# 29. Status Bar

Optional status indicator:

```text
AI: Local
```

or:

```text
AI: Cloud
```

or:

```text
AI: Offline
```

Clicking it should open a small configuration/status view.

---

# 30. Provider Status

The extension should expose:

```text
Provider: Ollama
Model: qwen-coder
Status: Connected
Latency: 182 ms
```

When unavailable:

```text
Provider: Ollama
Model: qwen-coder
Status: Unavailable
Reason: Connection refused
```

---

# 31. Command Palette Commands

Recommended commands:

```text
Local Copilot: Enable
Local Copilot: Disable
Local Copilot: Trigger Completion
Local Copilot: Select Model
Local Copilot: Select Provider
Local Copilot: Test Connection
Local Copilot: Show Diagnostics
Local Copilot: Clear Cache
Local Copilot: Open Settings
```

---

# 32. Model Selection UX

Users should be able to select a model without editing JSON manually.

Example Quick Pick:

```text
Select Model

● qwen-coder
  local

● deepseek-coder
  local

● company-coder
  remote
```

Provider and model capabilities should be displayed where useful:

```text
FIM
Streaming
Context: 32k
```

---

# 33. Performance Architecture

Performance is a first-class requirement.

## 33.1 Avoid Main Thread Blocking

Use asynchronous APIs for:

- File scanning.
- Parsing.
- Indexing.
- HTTP requests.
- Context retrieval.
- Embeddings.

---

# 34. Cache Architecture

Three cache layers:

## L1 — In-Memory Request Cache

Very short-lived.

Key:

```text
documentUri
documentVersion
cursor
provider
model
contextHash
```

## L2 — Completion Cache

Useful for repeated triggers and cursor movement.

TTL:

```text
1–30 seconds
```

## L3 — Context Cache

Cache:

- Parsed document structure.
- Imports.
- Symbols.
- File metadata.
- Relevant file relationships.

Do not cache sensitive prompt payloads to disk by default.

---

# 35. Context Indexing

MVP should avoid building a heavyweight repository vector database.

Phase 1:

- Current file.
- Open editors.
- Imports.
- Symbol lookup.
- Lightweight lexical ranking.

Phase 2:

- Repository index.
- Embeddings.
- Vector search.
- Reranker.

This keeps the MVP fast and simpler.

---

# 36. Optional Local Embeddings

Later versions can support local embeddings.

Possible architecture:

```text
Workspace
   |
   v
Chunker
   |
   v
Local Embedding Model
   |
   v
Vector Index
   |
   v
Top-K Relevant Chunks
   |
   v
Completion Context
```

Potential implementations:

- SQLite + vector extension.
- LanceDB.
- local pgvector.
- embedded vector index.

Embedding retrieval must never be on the critical path unless it can meet latency requirements.

---

# 37. Request Budget

Each completion request should have a budget.

Example:

```text
Debounce: 150 ms
Context build: 20 ms
Network/model: 300 ms
Normalization: 10 ms
Target total: <500 ms
```

If the request exceeds a configured timeout:

```text
cancel
discard
do not interrupt typing
```

---

# 38. Adaptive Latency Strategy

The extension should eventually become adaptive.

Example:

```text
If user is typing rapidly:
    use shorter context
    lower output token budget
    avoid repository search

If user pauses:
    build richer context
    allow slightly larger completion
```

This can substantially improve perceived responsiveness.

---

# 39. Fast Path / Slow Path Architecture

## Fast Path

Used for most keystrokes.

Context:

- Current line.
- Current block.
- Immediate prefix/suffix.

Goal:

```text
<300 ms
```

## Slow Path

Used only when necessary.

Context:

- Related files.
- Symbols.
- Repository retrieval.

Goal:

```text
<1000–2000 ms
```

The UI should still prefer fast-path results and avoid delaying suggestions unnecessarily.

---

# 40. Streaming

Streaming should be supported where it improves perceived latency.

However, the extension must avoid displaying unstable partial suggestions that create flicker.

Possible strategy:

```text
first useful token/chunk
       |
       v
buffer briefly
       |
       v
show stable suggestion
```

For models where streaming adds complexity without UX benefit, non-streaming completion is acceptable.

---

# 41. Model Routing

Future versions may support automatic routing.

Example:

```text
Tiny/Fast model
     |
     +---- simple completion -> use fast local model

Medium model
     |
     +---- moderate context -> use stronger local model

Cloud model
     |
     +---- difficult completion -> use cloud
```

Routing must respect:

```text
localOnly
privacy policy
workspace policy
cost limits
```

---

# 42. Accuracy Strategy

Accuracy should be improved in layers rather than relying only on larger models.

Priority order:

1. Better cursor context.
2. FIM.
3. Language-awareness.
4. Accurate prefix/suffix handling.
5. Relevant symbols.
6. Imports.
7. Relevant file retrieval.
8. Better model choice.
9. Reranking.
10. Specialized completion models.

---

# 43. Completion Quality Heuristics

A candidate can be scored using:

```text
quality =
    syntaxScore
  + prefixConsistency
  + suffixConsistency
  + identifierConsistency
  + repetitionPenalty
  + lengthPenalty
  + languageConsistency
```

The MVP can use deterministic heuristics.

Later, a lightweight reranker can compare multiple candidates.

---

# 44. Multi-Candidate Completion

Future support:

```text
Candidate A -> model 1
Candidate B -> model 2
Candidate C -> model 1 with different decoding
```

A reranker chooses the best suggestion.

This should **not** be enabled by default for MVP because it increases latency and compute.

---

# 45. Observability

Local diagnostics should measure:

```text
requestCount
successCount
failureCount
cancelledCount
cacheHitCount
averageLatency
P50Latency
P95Latency
averageCompletionTokens
acceptedSuggestions
rejectedSuggestions
```

---

# 46. Privacy Requirements

The extension must clearly document:

### Local Provider

Code remains on the local machine unless the selected local provider itself forwards it elsewhere.

### Cloud Provider

Selected context is sent to the configured provider.

### Telemetry

Telemetry must be opt-in or disabled by default for MVP.

Telemetry must not contain source code.

Never collect:

- Raw source code.
- API keys.
- File contents.
- Prompts containing code.
- Repository paths unless necessary and explicitly documented.

---

# 47. Security Requirements

- API keys stored using VS Code SecretStorage.
- No secret values in logs.
- HTTPS recommended for remote endpoints.
- Warn on plain HTTP remote endpoints.
- Local HTTP allowed for explicitly configured localhost endpoints.
- Validate endpoint URLs.
- Protect against SSRF-style abuse where possible.
- Do not fetch arbitrary URLs from model output.
- Never execute model-generated code automatically.
- Treat model output as untrusted text.

---

# 48. Workspace Trust

The extension should respect VS Code Workspace Trust.

Potential policy:

- Core autocomplete can work in trusted workspaces.
- Repository indexing may require trust.
- Executing project-specific tools is out of scope.
- No arbitrary code execution as part of autocomplete.

---

# 49. Configuration Precedence

Configuration order:

```text
Built-in Defaults
      |
      v
User Settings
      |
      v
Workspace Settings
      |
      v
Workspace Folder Settings
```

Secrets are always resolved through SecretStorage.

---

# 50. Recommended Monorepo Structure

```text
local-copilot/
├── packages/
│   ├── extension/
│   │   ├── src/
│   │   │   ├── extension.ts
│   │   │   ├── completion/
│   │   │   ├── providers/
│   │   │   ├── context/
│   │   │   ├── scheduler/
│   │   │   ├── cache/
│   │   │   ├── configuration/
│   │   │   ├── security/
│   │   │   ├── diagnostics/
│   │   │   └── ui/
│   │   └── package.json
│   │
│   ├── core/
│   │   ├── src/
│   │   │   ├── completion/
│   │   │   ├── providers/
│   │   │   ├── context/
│   │   │   ├── normalization/
│   │   │   └── evaluation/
│   │
│   ├── provider-openai-compatible/
│   ├── provider-ollama/
│   ├── provider-lmstudio/
│   ├── context-engine/
│   └── shared/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── provider/
│   └── evaluation/
│
├── benchmarks/
│   ├── latency/
│   ├── accuracy/
│   └── datasets/
│
├── docs/
│   ├── architecture/
│   ├── providers/
│   ├── privacy/
│   └── evaluation/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

A simpler single-package structure is acceptable for the first prototype.

---

# 51. Technology Recommendation

Recommended MVP stack:

## Extension

- TypeScript
- VS Code Extension API
- `vscode.InlineCompletionItemProvider`

## HTTP

- Native `fetch`
- `AbortController`

Avoid unnecessary HTTP abstractions in the hot path.

## Parsing

Start with:

- VS Code APIs
- Language server APIs where available

Add Tree-sitter selectively later.

## Testing

- Vitest or Jest
- VS Code Extension Test Runner
- Mock HTTP servers for provider tests

## Build

- esbuild or tsup
- npm/pnpm
- VSCE for packaging

---

# 52. MVP Feature Set

The MVP must include:

### P0

- [ ] VS Code inline completion provider.
- [ ] TypeScript/JavaScript/TSX/JSX support.
- [ ] Local OpenAI-compatible endpoint.
- [ ] Custom `baseUrl`.
- [ ] API key support.
- [ ] Configurable model.
- [ ] Debouncing.
- [ ] Cancellation.
- [ ] Timeout.
- [ ] Request versioning.
- [ ] Basic prefix/suffix context.
- [ ] FIM-compatible provider mode.
- [ ] Completion normalization.
- [ ] Local-only mode.
- [ ] SecretStorage for credentials.
- [ ] Basic diagnostics.
- [ ] Unit tests.
- [ ] Integration tests.
- [ ] Performance metrics.

### P1

- [ ] Ollama adapter.
- [ ] LM Studio adapter.
- [ ] Model discovery.
- [ ] Better symbol/context extraction.
- [ ] Open file context.
- [ ] Import-aware retrieval.
- [ ] Status bar UI.
- [ ] Manual trigger command.
- [ ] Provider test command.

### P2

- [ ] Repository index.
- [ ] Embeddings.
- [ ] Reranking.
- [ ] Multi-model routing.
- [ ] Candidate ranking.
- [ ] Advanced language-specific context.
- [ ] Completion analytics dashboard.

---

# 53. Acceptance Criteria — MVP

## AC-01 — Basic Completion

Given a TypeScript file and configured model:

- The extension displays an inline completion.
- The completion can be accepted using standard VS Code behavior.

## AC-02 — Local Provider

Given:

```text
http://localhost:11434/v1
```

and a valid model, autocomplete succeeds without contacting any external service.

## AC-03 — Custom Provider

Given a valid OpenAI-compatible endpoint and API key, autocomplete succeeds.

## AC-04 — Cancellation

When the user types again before the previous request completes:

- Previous request is cancelled when supported.
- Previous response is discarded if it arrives late.
- Only the newest document version can produce a visible completion.

## AC-05 — Timeout

When inference exceeds the configured timeout:

- Request is aborted.
- No error popup interrupts the user.
- Diagnostics record the timeout.

## AC-06 — Local-Only

With local-only mode enabled:

- Remote providers cannot be selected.
- Remote requests cannot be made.
- Telemetry remains disabled.

## AC-07 — Secret Storage

API keys are not stored directly as plaintext in workspace settings.

## AC-08 — No Main Thread Blocking

Typing must remain responsive during:

- Context building.
- HTTP requests.
- Cancellation.
- Completion normalization.

## AC-09 — Code Output

The extension must not show markdown fences or explanatory prose as inline code.

## AC-10 — Configuration

Changing provider/model/base URL should not require code changes.

---

# 54. Performance Acceptance Targets

These are initial engineering targets.

| Metric                   |                         Target |
| ------------------------ | -----------------------------: |
| Extension activation     |    < 500 ms incremental impact |
| Scheduling overhead      |                        < 10 ms |
| Context build (simple)   |                        < 20 ms |
| Cache lookup             |                         < 5 ms |
| Local completion P50     |                       < 300 ms |
| Cloud completion P50     |                       < 500 ms |
| Cancellation response    | < 50 ms where provider permits |
| Suggestion normalization |                        < 10 ms |
| Main UI blocking         |                          ~0 ms |

Hardware and model performance will significantly affect these numbers.

---

# 55. Accuracy Evaluation

A benchmark corpus should contain realistic tasks.

Categories:

1. Function completion.
2. Variable/property completion.
3. API usage.
4. Import completion.
5. Type completion.
6. JSX completion.
7. Error correction.
8. Test completion.
9. Configuration completion.
10. Algorithm/code continuation.

For every case, record:

```text
prompt/context
expected completion
model output
accepted/rejected
latency
```

---

# 56. Metrics

## Primary Metrics

### Suggestion Acceptance Rate

```text
accepted suggestions / shown suggestions
```

### First Suggestion Acceptance Rate

Useful for measuring ranking quality.

### Completion Latency

Measure:

```text
P50
P75
P95
```

### Rejection Rate

```text
dismissed suggestions / shown suggestions
```

### Empty Response Rate

```text
empty responses / requests
```

### Cancellation Rate

```text
cancelled requests / total requests
```

---

# 57. Offline Evaluation

Build a benchmark runner that can execute:

```bash
pnpm benchmark
```

Example output:

```text
Model: qwen-coder
Cases: 500

Acceptance-like score: 71.4%
Syntax-valid: 94.2%
P50 latency: 214 ms
P95 latency: 632 ms
Duplicate rate: 2.8%
```

The exact benchmark methodology must be documented before comparing models.

---

# 58. Online Evaluation

With telemetry explicitly enabled, record only privacy-safe aggregate metrics.

Example:

```json
{
  "provider": "local",
  "model": "qwen-coder",
  "language": "typescript",
  "latencyMs": 218,
  "accepted": true,
  "completionLength": 31
}
```

Never include raw code.

---

# 59. Logging

Logging levels:

```text
OFF
ERROR
WARN
INFO
DEBUG
TRACE
```

Default:

```text
WARN
```

Debug logs may include:

- Request timing.
- Provider status.
- Context token counts.
- Cache hits.
- Cancellation events.

Debug logs must not include raw source code unless the user explicitly enables a separate unsafe diagnostic mode.

---

# 60. Failure Handling

Common failures:

### Provider Unavailable

Show a non-blocking status indicator.

### Invalid API Key

Show actionable error:

```text
Authentication failed. Check your provider credentials.
```

### Model Not Found

```text
Model 'xyz' is unavailable at the configured endpoint.
```

### Timeout

Silently discard inline result and update diagnostics.

### Malformed Response

Normalize if possible; otherwise discard.

### Rate Limit

Apply short backoff.

---

# 61. Backoff

Cloud provider failures should use bounded exponential backoff.

Example:

```text
100 ms
250 ms
500 ms
1000 ms
```

Autocomplete should not aggressively retry because the user is typing.

Prefer skipping a request over causing additional latency.

---

# 62. Rate Limiting

Support a configurable request budget.

Example:

```text
maxRequestsPerMinute = 120
```

For local models, a high limit can be used.

For cloud models, a lower configurable limit prevents unexpected usage.

---

# 63. Model Profiles

Users should eventually be able to define profiles.

Example:

```json
{
  "profiles": {
    "fast-local": {
      "provider": "ollama",
      "model": "small-coder-model",
      "maxOutputTokens": 96
    },
    "smart-cloud": {
      "provider": "custom",
      "model": "strong-coder-model",
      "maxOutputTokens": 192
    }
  }
}
```

---

# 64. Per-Language Configuration

Example:

```json
{
  "typescript": "fast-local",
  "python": "smart-cloud",
  "java": "fast-local"
}
```

This is a future feature but should be supported by the configuration architecture.

---

# 65. Workspace Profiles

Projects can define:

```text
Project A -> local-only
Project B -> corporate private endpoint
Project C -> cloud endpoint
```

A workspace-specific configuration must override the global default.

---

# 66. Enterprise Considerations

Later versions may support:

- Private model gateways.
- Enterprise endpoint allowlists.
- Centralized configuration.
- Disable cloud providers.
- Policy enforcement.
- Audit-safe metrics.
- SSO for internal gateways.
- Proxy support.

---

# 67. Model Discovery

For OpenAI-compatible APIs, support optional model discovery:

```http
GET /v1/models
```

If available, the extension can populate:

```text
Select Model
-------------------------
qwen-coder
deepseek-coder
codestral
company-coder
```

If `/models` is unavailable, users can manually enter the model name.

---

# 68. Provider Capabilities

Every provider should expose capability information:

```ts
interface ProviderCapabilities {
  streaming: boolean;
  fim: boolean;
  modelListing: boolean;
  abort: boolean;
  auth: "none" | "apiKey" | "bearer" | "custom";
}
```

This allows the UI and orchestrator to adapt automatically.

---

# 69. Prompt Versioning

Prompt/input templates must be versioned.

Example:

```text
completion-v1
completion-v2
fim-v1
```

Benchmark results should record the prompt version.

This allows regressions to be identified.

---

# 70. Extension Commands and Diagnostics

Diagnostic command should show:

```text
Local Copilot Diagnostics

Extension Version: 0.1.0

Provider: Ollama
Endpoint: http://localhost:11434/v1
Model: qwen-coder

Local Only: Yes

Last Request:
  Status: Success
  Latency: 212 ms
  Context: 7.4k tokens
  Output: 48 tokens

Cache:
  Hits: 21
  Misses: 47

Errors:
  0
```

Sensitive configuration values must be masked.

---

# 71. Development Phases

## Phase 0 — Technical Spike

Goal:

Prove that VS Code inline completion + local model can feel responsive.

Tasks:

- Minimal extension.
- Inline completion provider.
- Local HTTP provider.
- Basic prefix/suffix.
- Cancellation.
- Latency measurement.

Success criterion:

> Developer can type TypeScript and receive usable local completions quickly.

---

# 72. Phase 1 — MVP Completion Engine

Implement:

- Scheduler.
- Cancellation.
- Provider abstraction.
- FIM.
- Prompt builder.
- Output normalization.
- Local provider.
- Custom OpenAI-compatible provider.
- SecretStorage.
- Settings.

---

# 73. Phase 2 — Quality Improvements

Implement:

- Symbol awareness.
- Imports.
- Better context selection.
- Context cache.
- Completion heuristics.
- Language-specific behavior.
- Model profiles.

---

# 74. Phase 3 — Repository Intelligence

Implement:

- Repository index.
- Relevant file retrieval.
- Local embeddings.
- Optional reranking.

Repository retrieval should remain disabled by default until latency is proven acceptable.

---

# 75. Phase 4 — Advanced Routing

Implement:

- Multi-model routing.
- Fast/slow paths.
- Candidate generation.
- Reranking.
- Model quality/latency profiles.

---

# 76. Phase 5 — Production Hardening

Implement:

- Robust error handling.
- Security review.
- Privacy documentation.
- Extension packaging.
- Automated benchmark suite.
- Regression testing.
- Memory/performance profiling.
- Marketplace readiness.

---

# 77. Testing Strategy

## Unit Tests

Test:

- Scheduler.
- Debounce logic.
- Cancellation.
- Request fingerprinting.
- Context selection.
- Prompt construction.
- Output normalization.
- Provider routing.
- Configuration merging.
- Security helpers.

## Integration Tests

Test:

- VS Code completion flow.
- Provider requests.
- Cancellation.
- Model discovery.
- SecretStorage.
- Workspace settings.

## End-to-End Tests

Test:

```text
open project
  ->
open TypeScript file
  ->
type code
  ->
completion appears
  ->
accept completion
```

---

# 78. Performance Testing

Run benchmark scenarios:

1. Small file.
2. Large file.
3. Monorepo.
4. Slow local model.
5. Fast local model.
6. Slow network.
7. Provider failure.
8. Rapid typing.
9. Large paste.
10. Multiple editors.

Measure memory usage and CPU usage in addition to latency.

---

# 79. Memory Requirements

The extension should avoid unbounded in-memory caches.

Requirements:

- Cache size limits.
- TTL.
- LRU eviction.
- No full-repository source caching by default.
- No persistent source-code cache in MVP.

---

# 80. CPU Requirements

Idle CPU usage should be close to zero.

The extension should not continuously index the repository unless explicitly enabled.

Background work should:

- Be throttled.
- Yield to editor activity.
- Stop during rapid typing.

---

# 81. UX Guardrails

The extension should reduce AI noise.

Potential rules:

- Do not show extremely short useless suggestions.
- Do not suggest duplicate words.
- Do not repeat existing code.
- Do not show suggestions after obvious syntax completion.
- Respect explicit dismissal.
- Temporarily suppress AI after repeated rejections.
- Avoid suggestion spam while typing rapidly.

---

# 82. Learning From User Behavior

Future versions may adapt to user behavior.

Possible signals:

```text
accepted quickly
accepted partially
ignored
rejected
manually typed instead
```

Use these only for local personalization in privacy-sensitive environments.

Do not automatically upload raw source or behavior to a cloud service.

---

# 83. Local Personalization

Future local model/ranking features:

- Preferred completion length.
- Preferred coding style.
- Repeated API usage patterns.
- Project-specific conventions.

Potential storage:

```text
~/.local-copilot/
```

But source data should be minimized and local by default.

---

# 84. Project Rules

Future project-specific rules could support:

```text
- Prefer functional React components.
- Use async/await.
- Do not use lodash.
- Use project-specific logger.
```

Potential source:

```text
.local-copilot/rules.md
```

This should be opt-in and treated as context, not executable instructions.

---

# 85. Environment Compatibility

The extension should support:

- macOS
- Windows
- Linux

Local providers may have platform-specific installation requirements, but the extension itself should remain cross-platform.

---

# 86. Offline Behavior

When completely offline:

- Local providers continue working.
- Remote providers become unavailable.
- No blocking network retries.
- The extension remains usable without errors on every keystroke.

---

# 87. Accessibility

Use VS Code's native UI patterns where possible.

Requirements:

- Keyboard-first operation.
- Screen-reader compatible status messages.
- Avoid custom inaccessible controls.
- Clear error messaging.
- Do not depend solely on color to communicate provider state.

---

# 88. Internationalization

Not required for MVP.

However, UI text should be centralized so localization can be added later.

---

# 89. Marketplace Positioning

Initial product message:

> **Private, Fast, Configurable AI Autocomplete for VS Code**

Supporting messages:

- Run models locally.
- Bring your own model.
- Use your own endpoint.
- OpenAI-compatible APIs supported.
- Privacy-first.
- Built for low-latency inline completion.

Avoid claiming that all local models will outperform cloud coding assistants.

---

# 90. Competitive Differentiation

The product should differentiate through:

### Local-First Architecture

Local inference is not an add-on.

### Bring Your Own Model

Users are not locked into a model vendor.

### Bring Your Own Endpoint

Custom `baseUrl` is a first-class concept.

### Performance-Oriented Pipeline

Cancellation, caching, lightweight context, and fast path are product features.

### Transparent Privacy

Users understand exactly where their code goes.

---

# 91. Risks

## R1 — Local Model Latency

A local model may be too slow to provide pleasant autocomplete.

Mitigation:

- Use small code models.
- Short context.
- Low output token budgets.
- Aggressive cancellation.
- Fast path.
- Hardware-aware model recommendations.

## R2 — Local Model Quality

Small models may produce poor completions.

Mitigation:

- Support stronger local models.
- Allow cloud providers.
- Add context retrieval.
- Benchmark models.

## R3 — Too Much Context

Large prompts increase latency and reduce model focus.

Mitigation:

- Context ranking.
- Token budgets.
- Current-file-first strategy.

## R4 — Suggestion Spam

Too many suggestions reduce usability.

Mitigation:

- Smart trigger logic.
- Debounce.
- Suppression rules.

## R5 — API Incompatibility

Not all "OpenAI-compatible" APIs behave identically.

Mitigation:

- Provider adapter.
- Capability detection.
- Compatibility tests.
- Configurable API behavior.

## R6 — Security

Cloud API keys or source code could leak.

Mitigation:

- SecretStorage.
- Local-only mode.
- No code logging.
- Secure defaults.

---

# 92. Future Roadmap

Potential features after production MVP:

### v0.2

- Ollama provider.
- LM Studio provider.
- Model discovery.
- Better diagnostics.
- Import-aware context.

### v0.3

- Repository index.
- Relevant file retrieval.
- Optional local embeddings.

### v0.4

- Multi-candidate generation.
- Reranking.
- Model routing.

### v0.5

- Project rules.
- Local personalization.
- Advanced language support.

### v1.0

- Production-grade performance.
- Extensive benchmark coverage.
- Marketplace release.
- Enterprise/private gateway support.

---

# 93. Definition of Done — MVP

The MVP is complete when:

- [ ] The extension installs cleanly on supported VS Code versions.
- [ ] Inline autocomplete works for TypeScript and JavaScript.
- [ ] A local OpenAI-compatible model can provide completions.
- [ ] A custom cloud OpenAI-compatible endpoint can provide completions.
- [ ] Provider/model/base URL/API key are configurable.
- [ ] API keys use VS Code SecretStorage.
- [ ] Request cancellation works.
- [ ] Stale completions never overwrite newer code.
- [ ] Basic FIM works where the model/provider supports it.
- [ ] Output normalization prevents markdown/explanatory text.
- [ ] Local-only mode is enforced.
- [ ] Basic diagnostics are available.
- [ ] Benchmark tooling measures latency.
- [ ] Unit/integration tests cover critical paths.
- [ ] No raw source code is sent to telemetry.
- [ ] No known memory leak exists in long-running sessions.
- [ ] Rapid typing remains responsive.

---

# 94. Recommended MVP Priorities

The implementation team should prioritize in this exact order:

```text
1. Inline completion integration
2. Cancellation + request versioning
3. Local provider
4. Fast prefix/suffix context
5. FIM
6. Provider abstraction
7. Custom OpenAI-compatible endpoint
8. Output normalization
9. Secret management
10. Performance benchmarks
11. Basic diagnostics
12. Symbol/import context
13. Repository context
```

Do not start with embeddings or repository-wide RAG.

The fastest route to a useful product is a **small, extremely optimized completion loop**.

---

# 95. Suggested MVP Success Benchmark

A practical MVP success benchmark:

> On a developer workstation running a supported small coding model locally, at least 70% of manually reviewed suggestions should be considered useful enough to keep or accept, while P50 end-to-end local completion latency remains below 300 ms for common TypeScript/JavaScript scenarios.

This is a product target for internal evaluation, not a guaranteed performance claim.

---

# 96. Architecture Decision Summary

| Area              | MVP Decision                                         |
| ----------------- | ---------------------------------------------------- |
| Editor            | VS Code                                              |
| Language          | TypeScript                                           |
| Completion API    | InlineCompletionItemProvider                         |
| Primary inference | Local                                                |
| Remote inference  | Optional                                             |
| Provider API      | OpenAI-compatible abstraction                        |
| Custom base URL   | Required                                             |
| API key           | Optional for local, required where provider needs it |
| Secrets           | VS Code SecretStorage                                |
| Context           | Current file first                                   |
| FIM               | Required where supported                             |
| Repository RAG    | Deferred                                             |
| Embeddings        | Deferred                                             |
| Cancellation      | Required                                             |
| Debounce          | Required                                             |
| Cache             | In-memory                                            |
| Telemetry         | Disabled by default                                  |
| Local-only mode   | Required                                             |
| Streaming         | Optional/provider-dependent                          |
| Testing           | Unit + integration + benchmark                       |
| Packaging         | VSIX                                                 |

---

# 97. Example End-to-End Request

```text
User types:
    const user = await getUserBy

          |
          v

VS Code Completion Provider
          |
          v

Request Scheduler
          |
          +--> debounce 120 ms
          |
          v

Context Engine

Prefix:
    const user = await getUserBy

Suffix:
    (
      id
    )

Nearby function/imports:
    ...
          |
          v

Prompt/FIM Builder
          |
          v

Provider Router
          |
          v

Ollama / LM Studio / Custom API
          |
          v

Model
          |
          v

Completion:
    Id(
          |
          v

Normalizer
          |
          v

Inline Completion:
    const user = await getUserById(
```

The user should perceive this as nearly immediate.

---

# 98. Product North Star

The product should optimize for one measurable developer experience:

> **"I forgot that AI was running because the suggestion appeared naturally before I needed it."**

That means:

- Low latency.
- High relevance.
- Minimal UI noise.
- Strong cancellation.
- Small, targeted context.
- Predictable behavior.
- Privacy by design.
- Model/provider freedom.

---

# 99. Final Product Statement

Local Copilot is a VS Code-native AI autocomplete engine built for developers who want the speed and privacy of local inference without giving up access to powerful cloud models.

Its architecture should remain deliberately modular:

```text
VS Code
   |
Completion Engine
   |
Context Engine
   |
Provider Router
   |
+-----------------------------+
|                             |
Local Models             Cloud Models
|                             |
Ollama / LM Studio       OpenAI / Custom
vLLM / etc.              OpenAI-compatible
+-----------------------------+
```

The most important engineering principle is:

> **Optimize the completion path before adding intelligence.**

A small, fast, accurate completion system is a stronger MVP than a large repository-aware AI system that takes too long to respond.
