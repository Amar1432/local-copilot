import { describe, it, expect } from "vitest";
import { isLocalEndpoint, validateLocalOnly } from "./privacy";
import { ProviderError } from "./provider.types";

describe("Privacy & Local-Only Enforcement", () => {
  describe("isLocalEndpoint", () => {
    it("should recognize localhost and subdomains as local", () => {
      expect(isLocalEndpoint("http://localhost:11434/v1")).toBe(true);
      expect(isLocalEndpoint("https://localhost")).toBe(true);
      expect(isLocalEndpoint("localhost:8080")).toBe(true);
      expect(isLocalEndpoint("http://app.localhost:3000")).toBe(true);
    });

    it("should recognize IPv4 loopback (127.0.0.1 and 127.x.x.x) as local", () => {
      expect(isLocalEndpoint("http://127.0.0.1:11434")).toBe(true);
      expect(isLocalEndpoint("http://127.0.0.1:8000/v1")).toBe(true);
      expect(isLocalEndpoint("http://127.0.1.1:5000")).toBe(true);
    });

    it("should recognize 0.0.0.0 as local", () => {
      expect(isLocalEndpoint("http://0.0.0.0:11434/v1")).toBe(true);
    });

    it("should recognize IPv6 loopback (::1 and [::1]) as local", () => {
      expect(isLocalEndpoint("http://[::1]:11434/v1")).toBe(true);
      expect(isLocalEndpoint("http://[::1]:8080")).toBe(true);
      expect(isLocalEndpoint("::1")).toBe(true);
    });

    it("should recognize *.local mDNS hostnames as local", () => {
      expect(isLocalEndpoint("http://mac-mini.local:11434/v1")).toBe(true);
      expect(isLocalEndpoint("http://server.local:8000")).toBe(true);
    });

    it("should reject remote and external URLs", () => {
      expect(isLocalEndpoint("https://api.openai.com/v1")).toBe(false);
      expect(isLocalEndpoint("https://api.anthropic.com")).toBe(false);
      expect(isLocalEndpoint("https://my-remote-inference.com/v1")).toBe(false);
      expect(isLocalEndpoint("http://8.8.8.8:11434")).toBe(false);
      expect(isLocalEndpoint("")).toBe(false);
    });
  });

  describe("validateLocalOnly", () => {
    it("should not throw when localOnly is disabled", () => {
      expect(() =>
        validateLocalOnly("https://api.openai.com/v1", false)
      ).not.toThrow();
    });

    it("should not throw when localOnly is enabled with local URLs", () => {
      expect(() =>
        validateLocalOnly("http://localhost:11434/v1", true)
      ).not.toThrow();

      expect(() =>
        validateLocalOnly("http://127.0.0.1:8000/v1", true)
      ).not.toThrow();

      expect(() =>
        validateLocalOnly("http://mac.local:11434", true)
      ).not.toThrow();
    });

    it("should throw ProviderError with clear message when localOnly is enabled with remote URLs", () => {
      expect(() =>
        validateLocalOnly("https://api.openai.com/v1", true)
      ).toThrow(ProviderError);

      try {
        validateLocalOnly("https://api.openai.com/v1", true);
      } catch (err) {
        expect((err as ProviderError).code).toBe("invalid_request");
        expect((err as ProviderError).retryable).toBe(false);
        expect((err as ProviderError).message).toContain("Local-only mode is enabled");
        expect((err as ProviderError).message).toContain("Blocked non-local URL");
        expect((err as ProviderError).message).toContain("localhost, 127.0.0.1, 0.0.0.0, [::1], *.local");
      }
    });
  });
});
