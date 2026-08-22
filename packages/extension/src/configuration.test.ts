import { describe, it, expect } from "vitest";
import { getConfiguration } from "./configuration";

describe("configuration", () => {
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

    // Verify all required fields exist
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
