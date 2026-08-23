import type * as vscode from "vscode";

const BASE_SECRET_KEY = "privateCopilot.apiKey";

/**
 * SecretManager coordinates secure storage, retrieval, and masking of API keys
 * using the VS Code SecretStorage API.
 */
export class SecretManager {
  constructor(private readonly secrets?: vscode.SecretStorage) {}

  /**
   * Securely retrieve the API key for a provider.
   * Checks provider-specific secret key first, then global secret key, then fallback value.
   */
  async getApiKey(provider?: string, fallbackValue?: string): Promise<string> {
    if (!this.secrets) {
      return (fallbackValue ?? "").trim();
    }

    if (provider) {
      const providerSecret = await this.secrets.get(
        `${BASE_SECRET_KEY}.${provider}`
      );
      if (providerSecret && providerSecret.trim()) {
        return providerSecret.trim();
      }
    }

    const defaultSecret = await this.secrets.get(BASE_SECRET_KEY);
    if (defaultSecret && defaultSecret.trim()) {
      return defaultSecret.trim();
    }

    return (fallbackValue ?? "").trim();
  }

  /**
   * Securely store the API key for a provider or default.
   */
  async setApiKey(apiKey: string, provider?: string): Promise<void> {
    if (!this.secrets) return;
    const key = provider ? `${BASE_SECRET_KEY}.${provider}` : BASE_SECRET_KEY;
    if (!apiKey || !apiKey.trim()) {
      await this.secrets.delete(key);
    } else {
      await this.secrets.store(key, apiKey.trim());
    }
  }

  /**
   * Delete the stored API key.
   */
  async deleteApiKey(provider?: string): Promise<void> {
    if (!this.secrets) return;
    const key = provider ? `${BASE_SECRET_KEY}.${provider}` : BASE_SECRET_KEY;
    await this.secrets.delete(key);
  }

  /**
   * Check if an API key is configured in SecretStorage.
   */
  async hasApiKey(provider?: string): Promise<boolean> {
    const key = await this.getApiKey(provider);
    return key.length > 0;
  }

  /**
   * Listen for changes to stored secrets.
   */
  onDidChange(
    callback: (e: vscode.SecretStorageChangeEvent) => void
  ): vscode.Disposable {
    if (!this.secrets?.onDidChange) {
      return { dispose: () => {} };
    }
    return this.secrets.onDidChange(callback);
  }

  /**
   * Mask an API key so it is safe to log or display in diagnostics/status.
   * e.g. "sk-1234567890abcdef" -> "sk-...cdef"
   * e.g. "short" -> "********"
   */
  static maskApiKey(apiKey: string): string {
    if (!apiKey || !apiKey.trim()) {
      return "(none)";
    }

    const trimmed = apiKey.trim();
    if (trimmed.length <= 8) {
      return "********";
    }

    const start = trimmed.slice(0, 3);
    const end = trimmed.slice(-4);
    return `${start}...${end}`;
  }
}
