import { describe, it, expect } from "vitest";
import * as core from "./index";

describe("core package exports", () => {
  it("should export ProviderError and provider type definitions", () => {
    expect(core.ProviderError).toBeDefined();
    expect(typeof core.ProviderError).toBe("function");
  });
});
