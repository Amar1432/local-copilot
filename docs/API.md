# API Documentation

## Provider Interface

### CompletionProvider Interface

```typescript
interface CompletionProvider {
  /** Unique provider identifier */
  id: string;

  /** Validate provider configuration */
  validateConfig(config: ProviderConfig): Promise<void>;

  /** List available models */
  getModels(): Promise<ModelInfo[]>;

  /** Generate completions */
  complete(request: CompletionRequest, signal: AbortSignal): Promise<CompletionResponse>;
}
```

### ProviderConfig

```typescript
interface ProviderConfig {
  /** Provider type */
  provider: "custom" | "ollama" | "openai" | "lmstudio" | "vllm";

  /** Base URL for API endpoint */
  baseUrl: string;

  /** API key (optional for local providers) */
  apiKey?: string;

  /** Model identifier */
  model: string;

  /** Maximum output tokens */
  maxOutputTokens?: number;

  /** Temperature (0-1) */
  temperature?: number;

  /** Request timeout in milliseconds */
  timeoutMs?: number;
}
```

### ModelInfo

```typescript
interface ModelInfo {
  /** Model identifier */
  id: string;

  /** Human-readable name */
  name?: string;

  /** Model capabilities */
  capabilities: ModelCapabilities;
}

interface ModelCapabilities {
  /** Supports streaming responses */
  streaming: boolean;

  /** Supports fill-in-the-middle */
  fim: boolean;

  /** Supports stop sequences */
  stopSequences: boolean;

  /** Context window size in tokens */
  contextWindow: number;

  /** Maximum output tokens */
  maxOutputTokens?: number;

  /** Authentication method required */
  auth: "none" | "apiKey" | "bearer" | "custom";
}
```

### CompletionRequest

```typescript
interface CompletionRequest {
  /** Unique request identifier */
  requestId: string;

  /** Document URI */
  documentUri: string;

  /** Document version */
  documentVersion: number;

  /** Cursor position */
  position: {
    line: number;
    character: number;
  };

  /** Code before cursor */
  prefix: string;

  /** Code after cursor */
  suffix: string;

  /** Programming language */
  language: string;

  /** Context snippets */
  context?: string[];

  /** FIM mode enabled */
  useFim: boolean;
}
```

### CompletionResponse

```typescript
interface CompletionResponse {
  /** Generated completion text */
  text: string;

  /** Whether completion is finished */
  isComplete: boolean;

  /** Token usage (if available) */
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };

  /** Finish reason */
  finishReason?: "stop" | "length" | "error";
}
```

## VS Code Extension API

### InlineCompletionItemProvider

```typescript
class LocalCopilotCompletionProvider implements vscode.InlineCompletionItemProvider {
  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | undefined>;
}
```

### Configuration Schema

```json
{
  "localCopilot.enabled": {
    "type": "boolean",
    "default": true,
    "description": "Enable/disable the extension"
  },
  "localCopilot.provider": {
    "type": "string",
    "enum": ["custom", "ollama", "openai", "lmstudio", "vllm"],
    "default": "custom",
    "description": "Provider type"
  },
  "localCopilot.baseUrl": {
    "type": "string",
    "default": "http://localhost:11434/v1",
    "description": "Provider base URL"
  },
  "localCopilot.apiKey": {
    "type": "string",
    "default": "",
    "description": "API key (stored in SecretStorage)"
  },
  "localCopilot.model": {
    "type": "string",
    "default": "",
    "description": "Model identifier"
  },
  "localCopilot.debounceMs": {
    "type": "number",
    "default": 150,
    "minimum": 0,
    "maximum": 1000,
    "description": "Debounce delay in milliseconds"
  },
  "localCopilot.requestTimeoutMs": {
    "type": "number",
    "default": 2000,
    "minimum": 500,
    "maximum": 10000,
    "description": "Request timeout in milliseconds"
  },
  "localCopilot.maxOutputTokens": {
    "type": "number",
    "default": 128,
    "minimum": 1,
    "maximum": 1024,
    "description": "Maximum output tokens"
  },
  "localCopilot.temperature": {
    "type": "number",
    "default": 0.1,
    "minimum": 0,
    "maximum": 1,
    "description": "Sampling temperature"
  },
  "localCopilot.context.maxLines": {
    "type": "number",
    "default": 120,
    "minimum": 10,
    "maximum": 500,
    "description": "Maximum context lines"
  },
  "localCopilot.localOnly": {
    "type": "boolean",
    "default": true,
    "description": "Block all remote requests"
  },
  "localCopilot.telemetry.enabled": {
    "type": "boolean",
    "default": false,
    "description": "Enable anonymous telemetry"
  }
}
```

## Error Responses

### Provider Errors

```typescript
interface ProviderError {
  /** Error code */
  code: "authentication" | "not_found" | "timeout" | "rate_limit" | "network" | "unknown";

  /** Human-readable message */
  message: string;

  /** Whether retry is recommended */
  retryable: boolean;
}
```

### Error Handling

| Error Code     | User Message                                                 | Action                               |
| -------------- | ------------------------------------------------------------ | ------------------------------------ |
| authentication | "Authentication failed. Check your provider credentials."    | Show error, suggest settings         |
| not_found      | "Model '{model}' is unavailable at the configured endpoint." | Show error, suggest model selection  |
| timeout        | "Request timed out."                                         | Silently discard, update diagnostics |
| rate_limit     | "Rate limit exceeded. Retrying..."                           | Apply backoff, retry                 |
| network        | "Unable to connect to provider."                             | Show status indicator                |
| unknown        | "Unexpected error occurred."                                 | Log error, show generic message      |

## Versioning Policy

- API version follows extension version (0.x.y)
- Breaking changes require minor version bump
- Deprecation notice provided one version before removal
- Provider interface changes are backward compatible when possible
