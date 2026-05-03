// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "../useDebouncedValue";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  test("returns the initial value synchronously", () => {
    const { result } = renderHook(() => useDebouncedValue("hello", 200));
    expect(result.current).toBe("hello");
  });

  test("delays updates by the configured delay", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 200), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current).toBe("b");
  });

  test("resets the timer when the value changes again before the delay elapses", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 200), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    act(() => { vi.advanceTimersByTime(150); });
    rerender({ v: "c" });
    act(() => { vi.advanceTimersByTime(150); });
    expect(result.current).toBe("a"); // first window cancelled
    act(() => { vi.advanceTimersByTime(60); });
    expect(result.current).toBe("c");
  });

  test("works with non-string types", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 100), {
      initialProps: { v: 1 },
    });
    rerender({ v: 42 });
    act(() => { vi.advanceTimersByTime(101); });
    expect(result.current).toBe(42);
  });
});
