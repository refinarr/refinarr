// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockSearch = new URLSearchParams();
const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearch,
  usePathname: () => "/logs",
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

import { useLogUrlState } from "../useLogUrlState";

beforeEach(() => {
  Array.from(mockSearch.keys()).forEach((k) => mockSearch.delete(k));
  mockReplace.mockReset();
  mockPush.mockReset();
});

describe("useLogUrlState", () => {
  it("parses empty URL into nulls and empty q", () => {
    const { result } = renderHook(() => useLogUrlState());
    expect(result.current.level).toBeNull();
    expect(result.current.source).toBeNull();
    expect(result.current.instanceId).toBeNull();
    expect(result.current.q).toBe("");
  });

  it("parses valid query params", () => {
    mockSearch.set("level", "warn");
    mockSearch.set("source", "auto-run");
    mockSearch.set("instanceId", "5");
    mockSearch.set("q", "hello");
    const { result } = renderHook(() => useLogUrlState());
    expect(result.current.level).toBe("warn");
    expect(result.current.source).toBe("auto-run");
    expect(result.current.instanceId).toBe(5);
    expect(result.current.q).toBe("hello");
  });

  it("rejects unknown level and source values", () => {
    mockSearch.set("level", "trace");
    mockSearch.set("source", "made-up-source");
    const { result } = renderHook(() => useLogUrlState());
    expect(result.current.level).toBeNull();
    expect(result.current.source).toBeNull();
  });

  it("rejects non-positive instanceId values", () => {
    mockSearch.set("instanceId", "-1");
    const { result } = renderHook(() => useLogUrlState());
    expect(result.current.instanceId).toBeNull();

    mockSearch.delete("instanceId");
    mockSearch.set("instanceId", "abc");
    const { result: r2 } = renderHook(() => useLogUrlState());
    expect(r2.current.instanceId).toBeNull();
  });

  it("setLevel calls router.replace (not push) with the new query string", () => {
    const { result } = renderHook(() => useLogUrlState());
    act(() => result.current.setLevel("error"));
    expect(mockReplace).toHaveBeenCalledWith("/logs?level=error");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("setInstanceId clears the param when called with null", () => {
    mockSearch.set("instanceId", "5");
    const { result } = renderHook(() => useLogUrlState());
    act(() => result.current.setInstanceId(null));
    expect(mockReplace).toHaveBeenCalledWith("/logs");
  });

  it("clearAll replaces with the bare pathname", () => {
    mockSearch.set("level", "warn");
    mockSearch.set("source", "auto-run");
    const { result } = renderHook(() => useLogUrlState());
    act(() => result.current.clearAll());
    expect(mockReplace).toHaveBeenCalledWith("/logs");
  });
});
