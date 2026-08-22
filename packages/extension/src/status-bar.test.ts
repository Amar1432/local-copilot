import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StatusBarManager } from "./status-bar";
import { spy, resetMocks } from "../__mocks__/vscode";

describe("StatusBarManager", () => {
  let statusBar: StatusBarManager;

  beforeEach(() => {
    resetMocks();
    statusBar = new StatusBarManager();
  });

  afterEach(() => {
    statusBar.dispose();
    resetMocks();
  });

  // -----------------------------------------------------------------------
  // Basic lifecycle
  // -----------------------------------------------------------------------

  it("should create a status bar item on construction", () => {
    expect(spy.statusBarItem).not.toBeNull();
  });

  it("should show the status bar item on construction", () => {
    expect(spy.statusBarItem?.visible).toBe(true);
  });

  it("should have a dispose method", () => {
    expect(typeof statusBar.dispose).toBe("function");
  });

  // -----------------------------------------------------------------------
  // Show / Hide
  // -----------------------------------------------------------------------

  describe("show/hide", () => {
    it("should show when show() is called", () => {
      statusBar.hide();
      expect(spy.statusBarItem?.visible).toBe(false);
      statusBar.show();
      expect(spy.statusBarItem?.visible).toBe(true);
    });

    it("should hide when hide() is called", () => {
      statusBar.hide();
      expect(spy.statusBarItem?.visible).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Status updates — local only
  // -----------------------------------------------------------------------

  describe("local-only mode", () => {
    it('should display "AI: Local Only" when connected and local-only', () => {
      statusBar.setStatus("connected", true);
      expect(spy.statusBarItem?.text).toBe("$(plug) AI: Local Only");
    });

    it('should display "AI: Checking..." when checking and local-only', () => {
      statusBar.setStatus("checking", true);
      expect(spy.statusBarItem?.text).toBe("$(sync~spin) AI: Checking...");
    });

    it('should display "AI: Local Only" warning when disconnected and local-only', () => {
      statusBar.setStatus("disconnected", true);
      expect(spy.statusBarItem?.text).toBe("$(warning) AI: Local Only");
    });
  });

  // -----------------------------------------------------------------------
  // Status updates — remote enabled
  // -----------------------------------------------------------------------

  describe("remote-enabled mode", () => {
    it('should display "AI: Connected" when connected and not local-only', () => {
      statusBar.setStatus("connected", false);
      expect(spy.statusBarItem?.text).toBe("$(check) AI: Connected");
    });

    it('should display "AI: Checking..." when checking and not local-only', () => {
      statusBar.setStatus("checking", false);
      expect(spy.statusBarItem?.text).toBe("$(sync~spin) AI: Checking...");
    });

    it('should display "AI: Offline" when disconnected and not local-only', () => {
      statusBar.setStatus("disconnected", false);
      expect(spy.statusBarItem?.text).toBe("$(x) AI: Offline");
    });
  });

  // -----------------------------------------------------------------------
  // Tooltip
  // -----------------------------------------------------------------------

  describe("tooltip", () => {
    it("should set appropriate tooltip for local-only connected", () => {
      statusBar.setStatus("connected", true);
      expect(spy.statusBarItem?.tooltip).toBe("Local Copilot — Local Only (connected)");
    });

    it("should set appropriate tooltip for remote connected", () => {
      statusBar.setStatus("connected", false);
      expect(spy.statusBarItem?.tooltip).toBe("Local Copilot — Connected");
    });

    it("should set appropriate tooltip for offline", () => {
      statusBar.setStatus("disconnected", false);
      expect(spy.statusBarItem?.tooltip).toBe("Local Copilot — Disconnected");
    });
  });

  // -----------------------------------------------------------------------
  // Dispose
  // -----------------------------------------------------------------------

  describe("dispose", () => {
    it("should dispose the underlying status bar item", () => {
      statusBar.dispose();
      expect(spy.statusBarItem?.disposed).toBe(true);
    });
  });
});
