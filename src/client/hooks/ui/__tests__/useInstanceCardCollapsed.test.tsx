// @vitest-environment happy-dom
import { describe, test, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useInstanceCardCollapsed } from "../useInstanceCardCollapsed";

describe("useInstanceCardCollapsed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("defaults to expanded (collapsed=false) when no preference stored", () => {
    const { result } = renderHook(() => useInstanceCardCollapsed(1));
    expect(result.current.collapsed).toBe(false);
  });

  test("reads stored 'true' as collapsed", () => {
    localStorage.setItem("rfn-inst-collapsed:1", "true");
    const { result } = renderHook(() => useInstanceCardCollapsed(1));
    expect(result.current.collapsed).toBe(true);
  });

  test("setCollapsed persists per-instance and updates the snapshot", () => {
    const { result } = renderHook(() => useInstanceCardCollapsed(7));
    act(() => result.current.setCollapsed(true));
    expect(localStorage.getItem("rfn-inst-collapsed:7")).toBe("true");
    expect(result.current.collapsed).toBe(true);
  });

  test("toggle flips the per-instance state", () => {
    const { result } = renderHook(() => useInstanceCardCollapsed(3));
    expect(result.current.collapsed).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
  });

  test("state is independent per id", () => {
    const a = renderHook(() => useInstanceCardCollapsed(1));
    const b = renderHook(() => useInstanceCardCollapsed(2));
    act(() => a.result.current.setCollapsed(true));
    expect(a.result.current.collapsed).toBe(true);
    expect(b.result.current.collapsed).toBe(false);
  });

  test("cross-instance sync: setCollapsed on one hook updates another with same id", () => {
    const a = renderHook(() => useInstanceCardCollapsed(5));
    const b = renderHook(() => useInstanceCardCollapsed(5));
    act(() => a.result.current.setCollapsed(true));
    expect(b.result.current.collapsed).toBe(true);
  });
});
