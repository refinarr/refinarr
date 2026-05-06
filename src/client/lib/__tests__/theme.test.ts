// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  applyBrandMode,
  getCurrentBrand,
  getCurrentMode,
  initializeTheme,
  resolveSurface,
  setBrand,
  setMode,
  THEME_BRAND_KEY,
  THEME_EVENT,
  THEME_LEGACY_KEY,
  THEME_MODE_KEY,
} from "../theme";
import { BRANDS, getBrandById } from "@/client/themes";

const AMBER = getBrandById("amber")!;
const TEAL = getBrandById("teal")!;

function setSystemPrefersDark(value: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark") ? value : !value,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("theme runtime (two-axis)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark", "theme-transition");
    document.documentElement.removeAttribute("style");
    setSystemPrefersDark(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registry exposes the two known brands", () => {
    expect(BRANDS.map((b) => b.id).sort()).toEqual(["amber", "teal"]);
  });

  it("resolveSurface returns light/dark verbatim and resolves system via matchMedia", () => {
    expect(resolveSurface("light")).toBe("light");
    expect(resolveSurface("dark")).toBe("dark");
    setSystemPrefersDark(true);
    expect(resolveSurface("system")).toBe("dark");
    setSystemPrefersDark(false);
    expect(resolveSurface("system")).toBe("light");
  });

  it("applyBrandMode writes the brand's vars for the resolved surface", () => {
    applyBrandMode(TEAL, "light");
    const style = document.documentElement.style;
    for (const [key, value] of Object.entries(TEAL.cssVars.light)) {
      expect(style.getPropertyValue(key)).toBe(value);
    }
    expect(document.documentElement.getAttribute("data-theme")).toBe("teal");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("applyBrandMode toggles the dark class for dark surface", () => {
    applyBrandMode(AMBER, "dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setBrand persists the brand and keeps the current mode", () => {
    setMode("light");
    expect(getCurrentMode()).toBe("light");
    setBrand("teal");
    expect(localStorage.getItem(THEME_BRAND_KEY)).toBe("teal");
    expect(getCurrentMode()).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("teal");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setMode persists the mode and keeps the current brand", () => {
    setBrand("teal");
    expect(getCurrentBrand().id).toBe("teal");
    setMode("dark");
    expect(localStorage.getItem(THEME_MODE_KEY)).toBe("dark");
    expect(getCurrentBrand().id).toBe("teal");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setBrand dispatches a change event with brand/mode/surface", () => {
    const handler = vi.fn();
    window.addEventListener(THEME_EVENT, handler);
    setMode("light");
    handler.mockClear();
    setBrand("teal");
    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.brand.id).toBe("teal");
    expect(detail.mode).toBe("light");
    expect(detail.surface).toBe("light");
    window.removeEventListener(THEME_EVENT, handler);
  });

  it("setBrand falls back to default for unknown ids", () => {
    setBrand("does-not-exist");
    expect(localStorage.getItem(THEME_BRAND_KEY)).toBe("amber");
  });

  it("getCurrentMode falls back to default when storage is empty", () => {
    expect(getCurrentMode()).toBe("system");
  });

  it("initializeTheme applies the persisted brand+mode", () => {
    localStorage.setItem(THEME_BRAND_KEY, "teal");
    localStorage.setItem(THEME_MODE_KEY, "light");
    initializeTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("teal");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("migrates rfn-theme=dark-orange → brand=amber, mode=dark", () => {
    localStorage.setItem(THEME_LEGACY_KEY, "dark-orange");
    initializeTheme();
    expect(localStorage.getItem(THEME_BRAND_KEY)).toBe("amber");
    expect(localStorage.getItem(THEME_MODE_KEY)).toBe("dark");
    expect(localStorage.getItem(THEME_LEGACY_KEY)).toBeNull();
  });

  it("migrates rfn-theme=dark-teal → brand=teal, mode=dark", () => {
    localStorage.setItem(THEME_LEGACY_KEY, "dark-teal");
    initializeTheme();
    expect(localStorage.getItem(THEME_BRAND_KEY)).toBe("teal");
    expect(localStorage.getItem(THEME_MODE_KEY)).toBe("dark");
    expect(localStorage.getItem(THEME_LEGACY_KEY)).toBeNull();
  });

  it("migrates rfn-theme=light → brand=amber, mode=light", () => {
    localStorage.setItem(THEME_LEGACY_KEY, "light");
    initializeTheme();
    expect(localStorage.getItem(THEME_BRAND_KEY)).toBe("amber");
    expect(localStorage.getItem(THEME_MODE_KEY)).toBe("light");
  });

  it("does not migrate when both new keys are present", () => {
    localStorage.setItem(THEME_LEGACY_KEY, "dark-teal");
    localStorage.setItem(THEME_BRAND_KEY, "amber");
    localStorage.setItem(THEME_MODE_KEY, "light");
    initializeTheme();
    expect(localStorage.getItem(THEME_BRAND_KEY)).toBe("amber");
    expect(localStorage.getItem(THEME_MODE_KEY)).toBe("light");
    // legacy is still cleaned up since both new keys exist
    expect(localStorage.getItem(THEME_LEGACY_KEY)).toBeNull();
  });

  it("setMode adds and removes the theme-transition class", () => {
    vi.useFakeTimers();
    setMode("dark");
    expect(
      document.documentElement.classList.contains("theme-transition"),
    ).toBe(true);
    vi.advanceTimersByTime(250);
    expect(
      document.documentElement.classList.contains("theme-transition"),
    ).toBe(false);
  });
});
