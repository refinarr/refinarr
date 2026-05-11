// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useColumnSizing } from "../useColumnSizing";

const STORAGE_PREFIX = "media-table-sizing:";

describe("useColumnSizing", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts with an empty sizing state when nothing is persisted", () => {
    const { result } = renderHook(() => useColumnSizing("movies"));
    expect(result.current.columnSizing).toEqual({});
  });

  it("hydrates from localStorage on mount", () => {
    window.localStorage.setItem(
      STORAGE_PREFIX + "movies",
      JSON.stringify({ title: 240 }),
    );
    const { result } = renderHook(() => useColumnSizing("movies"));
    expect(result.current.columnSizing).toEqual({ title: 240 });
  });

  it("persists updates back to localStorage", () => {
    const { result } = renderHook(() => useColumnSizing("shows"));
    act(() => result.current.onColumnSizingChange({ score: 160 }));
    expect(result.current.columnSizing).toEqual({ score: 160 });
    expect(window.localStorage.getItem(STORAGE_PREFIX + "shows")).toBe(
      JSON.stringify({ score: 160 }),
    );
  });

  it("supports functional updaters (TanStack contract)", () => {
    const { result } = renderHook(() => useColumnSizing("movies"));
    act(() => result.current.onColumnSizingChange({ title: 200 }));
    act(() =>
      result.current.onColumnSizingChange((prev) => ({
        ...prev,
        score: 180,
      })),
    );
    expect(result.current.columnSizing).toEqual({ title: 200, score: 180 });
  });

  it("resetColumnSize removes one entry and leaves others intact", () => {
    const { result } = renderHook(() => useColumnSizing("movies"));
    act(() => result.current.onColumnSizingChange({ title: 220, score: 150 }));
    act(() => result.current.resetColumnSize("title"));
    expect(result.current.columnSizing).toEqual({ score: 150 });
  });

  it("resetColumnSize is a no-op when the column isn't in state", () => {
    const { result } = renderHook(() => useColumnSizing("movies"));
    act(() => result.current.onColumnSizingChange({ title: 220 }));
    const before = result.current.columnSizing;
    act(() => result.current.resetColumnSize("missing"));
    // Same object reference — the hook should not invalidate state when
    // there's nothing to remove.
    expect(result.current.columnSizing).toBe(before);
  });

  it("keys per tableId so movies + shows don't share state", () => {
    const movies = renderHook(() => useColumnSizing("movies"));
    const shows = renderHook(() => useColumnSizing("shows"));
    act(() => movies.result.current.onColumnSizingChange({ title: 240 }));
    expect(shows.result.current.columnSizing).toEqual({});
  });

  it("recovers from corrupted localStorage payloads", () => {
    window.localStorage.setItem(STORAGE_PREFIX + "movies", "{not json");
    const { result } = renderHook(() => useColumnSizing("movies"));
    expect(result.current.columnSizing).toEqual({});
  });
});
