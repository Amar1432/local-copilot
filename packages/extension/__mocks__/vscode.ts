/**
 * Minimal vscode mock for unit testing.
 * Only mocks the APIs actually used by our extension modules.
 */

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

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

class MockStatusBarItem {
  text = "";
  tooltip = "";
  command = "";
  color: unknown = undefined;

  show(): void {}
  hide(): void {}
  dispose(): void {}
}

class MockInputBox {
  show(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
}

class MockQuickPick {
  show(): Promise<unknown> {
    return Promise.resolve(undefined);
  }
}

class MockDisposable {
  dispose(): void {}
}

const mockConfig: Record<string, unknown> = {
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
  localOnly: true,
  "telemetry.enabled": false,
};

export const workspace = {
  getConfiguration: (_section?: string) => ({
    get: <T>(key: string, defaultValue: T): T => {
      const val = mockConfig[key];
      return (val !== undefined ? val : defaultValue) as T;
    },
    update: async (): Promise<void> => {},
  }),
  onDidChangeConfiguration: (_listener: unknown): MockDisposable => {
    return new MockDisposable();
  },
};

export const window = {
  createStatusBarItem: (_alignment?: StatusBarAlignment, _priority?: number): MockStatusBarItem => {
    return new MockStatusBarItem();
  },
  showInformationMessage: (_message: string, _options?: unknown): void => {},
  showInputBox: async (): Promise<string | undefined> => {
    return undefined;
  },
  showQuickPick: async (): Promise<unknown> => {
    return undefined;
  },
};

export const commands = {
  registerCommand: (
    _command: string,
    _callback: (...args: unknown[]) => unknown
  ): MockDisposable => {
    return new MockDisposable();
  },
  executeCommand: async (_command: string): Promise<void> => {},
};

export const languages = {
  registerInlineCompletionItemProvider: (
    _selector: unknown,
    _provider: unknown
  ): MockDisposable => {
    return new MockDisposable();
  },
};

export class ThemeColor {
  constructor(public readonly id: string) {}
}
