import { describe, it, expect, beforeEach } from "vitest";
import { SecretManager } from "./secret-manager";
import { MockSecretStorage } from "../__mocks__/vscode";
import type * as vscode from "vscode";

describe("SecretManager", () => {
  let mockSecrets: MockSecretStorage;
  let secretManager: SecretManager;

  beforeEach(() => {
    mockSecrets = new MockSecretStorage();
    secretManager = new SecretManager(mockSecrets as unknown as vscode.SecretStorage);
  });

  describe("API key retrieval and storage", () => {
    it("should return empty string when no secret exists and no fallback", async () => {
      const key = await secretManager.getApiKey("openai");
      expect(key).toBe("");
    });

    it("should return fallback value when no secret exists in storage", async () => {
      const key = await secretManager.getApiKey("openai", "fallback-key");
      expect(key).toBe("fallback-key");
    });

    it("should prioritize provider-specific secret over global secret and fallback", async () => {
      await secretManager.setApiKey("global-secret");
      await secretManager.setApiKey("openai-secret", "openai");

      const openaiKey = await secretManager.getApiKey("openai", "fallback");
      expect(openaiKey).toBe("openai-secret");

      const customKey = await secretManager.getApiKey("custom", "fallback");
      expect(customKey).toBe("global-secret");
    });

    it("should delete secret when setApiKey is called with empty string", async () => {
      await secretManager.setApiKey("my-secret", "openai");
      expect(await secretManager.hasApiKey("openai")).toBe(true);

      await secretManager.setApiKey("", "openai");
      expect(await secretManager.hasApiKey("openai")).toBe(false);
    });

    it("should delete API key on deleteApiKey", async () => {
      await secretManager.setApiKey("my-secret", "lmstudio");
      expect(await secretManager.hasApiKey("lmstudio")).toBe(true);

      await secretManager.deleteApiKey("lmstudio");
      expect(await secretManager.hasApiKey("lmstudio")).toBe(false);
    });
  });

  describe("maskApiKey", () => {
    it("should mask empty or undefined keys as (none)", () => {
      expect(SecretManager.maskApiKey("")).toBe("(none)");
      expect(SecretManager.maskApiKey("   ")).toBe("(none)");
    });

    it("should mask short keys with asterisks", () => {
      expect(SecretManager.maskApiKey("short")).toBe("********");
      expect(SecretManager.maskApiKey("12345678")).toBe("********");
    });

    it("should mask long API keys showing only head and tail characters", () => {
      expect(SecretManager.maskApiKey("sk-1234567890abcdef")).toBe("sk-...cdef");
      expect(SecretManager.maskApiKey("openai-key-secret-9999")).toBe("ope...9999");
    });
  });

  describe("events", () => {
    it("should notify listeners on secret changes", async () => {
      const receivedEvents: string[] = [];
      secretManager.onDidChange((e) => {
        receivedEvents.push(e.key);
      });

      await secretManager.setApiKey("secret-1", "ollama");
      expect(receivedEvents).toContain("localCopilot.apiKey.ollama");
    });
  });
});
