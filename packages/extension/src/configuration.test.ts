import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getConfiguration } from "./configuration";
import { mockConfig, resetMocks } from "../__mocks__/vscode";

describe("configuration", () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    resetMocks();
  });

  // -----------------------------------------------------------------------
  // Default values
  // -----------------------------------------------------------------------

  describe("defaults", () => {
    it("should return default configuration values", () => {
      const config = getConfiguration();

      expect(config.enabled).toBe(true);
      expect(config.provider).toBe("custom");
      expect(config.baseUrl).toBe("http://localhost:11434/v1");
      expect(config.apiKey).toBe("");
      expect(config.model).toBe("qwen-coder");
      expect(config.debounceMs).toBe(150);
      expect(config.requestTimeoutMs).toBe(2000);
      expect(config.maxOutputTokens).toBe(128);
      expect(config.temperature).toBe(0.1);
      expect(config.contextMaxLines).toBe(120);
      expect(config.localOnly).toBe(true);
      expect(config.telemetryEnabled).toBe(false);
    });

    it("should return a ProviderConfig-compatible object", () => {
      const config = getConfiguration();

      expect(typeof config.enabled).toBe("boolean");
      expect(typeof config.provider).toBe("string");
      expect(typeof config.baseUrl).toBe("string");
      expect(typeof config.model).toBe("string");
      expect(typeof config.debounceMs).toBe("number");
      expect(typeof config.requestTimeoutMs).toBe("number");
      expect(typeof config.maxOutputTokens).toBe("number");
      expect(typeof config.temperature).toBe("number");
      expect(typeof config.contextMaxLines).toBe("number");
      expect(typeof config.localOnly).toBe("boolean");
      expect(typeof config.telemetryEnabled).toBe("boolean");
    });
  });

  // -----------------------------------------------------------------------
  // Custom values from mock config
  // -----------------------------------------------------------------------

  describe("custom values", () => {
    it("should read custom model from mock config", () => {
      mockConfig.model = "deepseek-coder";
      const config = getConfiguration();
      expect(config.model).toBe("deepseek-coder");
    });

    it("should read custom provider from mock config", () => {
      mockConfig.provider = "ollama";
      const config = getConfiguration();
      expect(config.provider).toBe("ollama");
    });

    it("should read custom baseUrl from mock config", () => {
      mockConfig.baseUrl = "http://127.0.0.1:8080/v1";
      const config = getConfiguration();
      expect(config.baseUrl).toBe("http://127.0.0.1:8080/v1");
    });

    it("should read custom debounceMs from mock config", () => {
      mockConfig.debounceMs = 300;
      const config = getConfiguration();
      expect(config.debounceMs).toBe(300);
    });

    it("should read localOnly as false from mock config", () => {
      mockConfig.localOnly = false;
      const config = getConfiguration();
      expect(config.localOnly).toBe(false);
    });

    it("should read enabled as false from mock config", () => {
      mockConfig.enabled = false;
      const config = getConfiguration();
      expect(config.enabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Fallback to defaults when config key is missing
  // -----------------------------------------------------------------------

  describe("fallback behavior", () => {
    it("should fall back to default when config key is undefined", () => {
      delete mockConfig.model;
      const config = getConfiguration();
      expect(config.model).toBe("");
    });
  });

  // -----------------------------------------------------------------------
  // Context budget preset
  // -----------------------------------------------------------------------

  describe("context budget preset", () => {
    it("should return balanced as default budget preset", () => {
      const config = getConfiguration();
      expect(config.contextBudgetPreset).toBe("balanced");
    });

    it("should read custom budget preset from mock config", () => {
      mockConfig["context.budgetPreset"] = "fast";
      const config = getConfiguration();
      expect(config.contextBudgetPreset).toBe("fast");
    });

    it("should read rich budget preset from mock config", () => {
      mockConfig["context.budgetPreset"] = "rich";
      const config = getConfiguration();
      expect(config.contextBudgetPreset).toBe("rich");
    });
  });
});
