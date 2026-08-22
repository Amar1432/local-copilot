import { describe, it, expect, beforeEach } from "vitest";
import { StatusBarManager } from "./status-bar";

describe("StatusBarManager", () => {
  let statusBar: StatusBarManager;

  beforeEach(() => {
    statusBar = new StatusBarManager();
  });

  it("should create a status bar item", () => {
    expect(statusBar).toBeDefined();
  });

  it("should have a show method", () => {
    expect(typeof statusBar.show).toBe("function");
    // Should not throw
    statusBar.show();
  });

  it("should have a hide method", () => {
    expect(typeof statusBar.hide).toBe("function");
    // Should not throw
    statusBar.hide();
  });

  it("should accept status updates", () => {
    // Should not throw when setting different statuses
    statusBar.setStatus("connected", false);
    statusBar.setStatus("disconnected", true);
    statusBar.setStatus("checking", false);
    statusBar.setStatus("connected", true);
  });

  it("should have a dispose method", () => {
    expect(typeof statusBar.dispose).toBe("function");
    // Should not throw
    statusBar.dispose();
  });
});
