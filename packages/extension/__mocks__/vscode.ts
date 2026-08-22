/**
 * Configurable vscode mock for unit testing.
 *
 * Usage:
 *   import { mockWorkspace, resetMocks } from "__mocks__/vscode";
 *   mockWorkspace.config = { model: "custom-model" };
 *   // ... test ...
 *   resetMocks();
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position
  ) {}
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

// ---------------------------------------------------------------------------
// Mock disposables — track calls for assertions
// ---------------------------------------------------------------------------

export class MockDisposable {
  disposed = false;
  dispose(): void {
    this.disposed = true;
  }
}

// ---------------------------------------------------------------------------
// Mock status bar item — tracks text, tooltip, visibility
// ---------------------------------------------------------------------------

export class MockStatusBarItem {
  text = "";
  tooltip = "";
  command = "";
  color: unknown = undefined;
  visible = false;
  disposed = false;

  show(): void {
    this.visible = true;
  }
  hide(): void {
    this.visible = false;
  }
  dispose(): void {
    this.disposed = true;
  }
}

// ---------------------------------------------------------------------------
// Mutable mock config — tests can override per-test
// ---------------------------------------------------------------------------

export const mockConfig: Record<string, unknown> = {
  enabled: true,
  provider: "custom",
  baseUrl: "http://localhost:11434/v1",
  apiKey: "",
  model: "qwen-coder",
  debounceMs: 150,
  requestTimeoutMs: 2000,
  maxOutputTokens: 128,
  temperature: 0.1,
  "context.maxLines": 120,
  "context.budgetPreset": "balanced",
  localOnly: true,
  "telemetry.enabled": false,
};

export class MockSecretStorage {
  private secrets: Map<string, string> = new Map();
  private listeners: Array<(e: { key: string }) => void> = [];

  async get(key: string): Promise<string | undefined> {
    return this.secrets.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.secrets.set(key, value);
    for (const listener of this.listeners) {
      listener({ key });
    }
  }

  async delete(key: string): Promise<void> {
    this.secrets.delete(key);
    for (const listener of this.listeners) {
      listener({ key });
    }
  }

  onDidChange(listener: (e: { key: string }) => void): MockDisposable {
    this.listeners.push(listener);
    return new MockDisposable();
  }

  clear(): void {
    this.secrets.clear();
    this.listeners = [];
  }
}

// ---------------------------------------------------------------------------
// Spy trackers — record calls for assertions
// ---------------------------------------------------------------------------

export const spy = {
  informationMessages: [] as string[],
  commands: [] as { command: string; args: unknown[] }[],
  configurationUpdates: [] as {
    section: string;
    key: string;
    value: unknown;
    target: unknown;
  }[],
  statusBarItem: null as MockStatusBarItem | null,
  secrets: new MockSecretStorage(),
};

/**
 * Reset all spies and config to defaults.
 */
export function resetMocks(): void {
  spy.informationMessages = [];
  spy.commands = [];
  spy.configurationUpdates = [];
  spy.statusBarItem = null;
  spy.secrets.clear();

  mockConfig.enabled = true;
  mockConfig.provider = "custom";
  mockConfig.baseUrl = "http://localhost:11434/v1";
  mockConfig.apiKey = "";
  mockConfig.model = "qwen-coder";
  mockConfig.debounceMs = 150;
  mockConfig.requestTimeoutMs = 2000;
  mockConfig.maxOutputTokens = 128;
  mockConfig.temperature = 0.1;
  mockConfig["context.maxLines"] = 120;
  mockConfig["context.budgetPreset"] = "balanced";
  mockConfig.localOnly = true;
  mockConfig["telemetry.enabled"] = false;
}

// ---------------------------------------------------------------------------
// workspace namespace
// ---------------------------------------------------------------------------

export class Uri {
  static parse(uri: string): Uri {
    return new Uri(uri);
  }
  static file(path: string): Uri {
    return new Uri(`file://${path}`);
  }
  constructor(public readonly fsPath: string) {}
  toString(): string {
    return this.fsPath;
  }
}

const mockFs = {
  stat: async (_uri: Uri): Promise<void> => {
    throw new Error("File not found (mock)");
  },
  readFile: async (_uri: Uri): Promise<Uint8Array> => {
    throw new Error("File not found (mock)");
  },
};

export const workspace = {
  getConfiguration: (_section?: string) => ({
    get: <T>(key: string, defaultValue: T): T => {
      const val = mockConfig[key];
      return (val !== undefined ? val : defaultValue) as T;
    },
    update: async (key: string, value: unknown, target?: unknown): Promise<void> => {
      spy.configurationUpdates.push({
        section: _section ?? "",
        key,
        value,
        target,
      });
    },
  }),
  onDidChangeConfiguration: (_listener: unknown): MockDisposable => {
    return new MockDisposable();
  },
  onDidOpenTextDocument: (_listener: unknown): MockDisposable => {
    return new MockDisposable();
  },
  onDidChangeTextDocument: (_listener: unknown): MockDisposable => {
    return new MockDisposable();
  },
  onDidCloseTextDocument: (_listener: unknown): MockDisposable => {
    return new MockDisposable();
  },
  textDocuments: [] as unknown[],
  fs: mockFs,
};

// ---------------------------------------------------------------------------
// window namespace
// ---------------------------------------------------------------------------

export const window = {
  createStatusBarItem: (_alignment?: StatusBarAlignment, _priority?: number): MockStatusBarItem => {
    const item = new MockStatusBarItem();
    spy.statusBarItem = item;
    return item;
  },
  showInformationMessage: (message: string, _options?: unknown): void => {
    spy.informationMessages.push(message);
  },
  showInputBox: async (): Promise<string | undefined> => {
    return undefined;
  },
  showQuickPick: async (): Promise<unknown> => {
    return undefined;
  },
};

// ---------------------------------------------------------------------------
// commands namespace
// ---------------------------------------------------------------------------

export const commands = {
  registerCommand: (command: string, callback: (...args: unknown[]) => unknown): MockDisposable => {
    spy.commands.push({ command, args: [] });
    return new MockDisposable();
  },
  executeCommand: async (command: string, ...args: unknown[]): Promise<void> => {
    spy.commands.push({ command, args });
  },
};

// ---------------------------------------------------------------------------
// languages namespace
// ---------------------------------------------------------------------------

export const languages = {
  registerInlineCompletionItemProvider: (
    _selector: unknown,
    _provider: unknown
  ): MockDisposable => {
    return new MockDisposable();
  },
};
