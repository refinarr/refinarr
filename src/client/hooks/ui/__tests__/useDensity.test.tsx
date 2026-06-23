// @vitest-environment happy-dom
import { describe, test, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDensity } from "../useDensity";

describe("useDensity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("defaults to cozy when no preference is stored", () => {
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("cozy");
  });

  test("reads stored value from localStorage", () => {
    localStorage.setItem("rfn-density", "compact");
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("compact");
  });

  test("setDensity persists to localStorage and updates the snapshot", () => {
    const { result } = renderHook(() => useDensity());
    act(() => result.current.setDensity("compact"));
    expect(localStorage.getItem("rfn-density")).toBe("compact");
    expect(result.current.density).toBe("compact");
  });

  test("toggle flips cozy ↔ compact", () => {
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("cozy");
    act(() => result.current.toggle());
    expect(result.current.density).toBe("compact");
    act(() => result.current.toggle());
    expect(result.current.density).toBe("cozy");
  });

  test("cycle advances cozy → compact → poster → cozy (card not in the desktop cycle)", () => {
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("cozy");
    act(() => result.current.cycle());
    expect(result.current.density).toBe("compact");
    act(() => result.current.cycle());
    expect(result.current.density).toBe("poster");
    act(() => result.current.cycle());
    expect(result.current.density).toBe("cozy");
  });

  test("cycle from a stored 'card' (removed desktop mode) restarts at cozy (#129)", () => {
    localStorage.setItem("rfn-density", "card");
    const { result } = renderHook(() => useDensity());
    // The value is still accepted (mobile renders a card list for it)…
    expect(result.current.density).toBe("card");
    // …but cycling on desktop drops out of the removed mode rather than
    // leaving the user stuck on it.
    act(() => result.current.cycle());
    expect(result.current.density).toBe("cozy");
  });

  test("ignores garbage values in localStorage", () => {
    localStorage.setItem("rfn-density", "garbage");
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("cozy");
  });

  test("cross-instance sync: setDensity in one instance updates another", () => {
    const a = renderHook(() => useDensity());
    const b = renderHook(() => useDensity());
    act(() => a.result.current.setDensity("compact"));
    expect(b.result.current.density).toBe("compact");
  });
});
