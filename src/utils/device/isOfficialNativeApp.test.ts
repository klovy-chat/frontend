import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  OFFICIAL_NATIVE_APP_UA_TOKEN,
  isOfficialNativeApp,
} from "./isOfficialNativeApp";

describe("isOfficialNativeApp", () => {
  const originalUa = navigator.userAgent;

  beforeEach(() => {
    delete document.documentElement.dataset.klovyNative;
    // @ts-expect-error test override
    delete window.__TAURI__;
    // @ts-expect-error test override
    delete window.__TAURI_INTERNALS__;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: originalUa,
    });
    delete document.documentElement.dataset.klovyNative;
  });

  it("returns true for official mobile UA token", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: `Mozilla/5.0 Mobile Safari/537.36 ${OFFICIAL_NATIVE_APP_UA_TOKEN}1.0`,
    });

    expect(isOfficialNativeApp()).toBe(true);
  });

  it("returns true for dom marker from index.html bootstrap", () => {
    document.documentElement.dataset.klovyNative = "1";
    expect(isOfficialNativeApp()).toBe(true);
  });

  it("returns true for desktop Tauri runtime", () => {
    window.__TAURI__ = {};
    expect(isOfficialNativeApp()).toBe(true);
  });

  it("returns false for regular mobile browser", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36",
    });

    expect(isOfficialNativeApp()).toBe(false);
  });
});
