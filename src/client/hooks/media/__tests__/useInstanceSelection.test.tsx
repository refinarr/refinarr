// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockSearch = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearch,
}));

vi.mock("@/client/lib/api", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/client/lib/api";
import { useInstanceSelection, parseUrlInstance } from "../useInstanceSelection";

const mockApi = vi.mocked(api);

const radarr1 = { id: 1, type: "radarr", name: "Radarr-1", url: "http://x", enabled: true, createdAt: "" };
const radarr2 = { id: 2, type: "radarr", name: "Radarr-2", url: "http://y", enabled: true, createdAt: "" };
const sonarr1 = { id: 3, type: "sonarr", name: "Sonarr-1", url: "http://z", enabled: true, createdAt: "" };

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("parseUrlInstance", () => {
  it.each([
    ["all", "all" as const],
    ["1", 1],
    ["42", 42],
    [null, 0],
    ["", 0],
    ["0", 0],
    ["-3", 0],
    ["abc", 0],
  ])("parses %p → %p", (input, expected) => {
    expect(parseUrlInstance(input)).toEqual(expected);
  });
});

describe("useInstanceSelection", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockSearch.delete("instanceId");
  });

  it("filters instances by arrType and exposes typed ids", async () => {
    mockApi.get.mockResolvedValue([radarr1, radarr2, sonarr1]);
    const { result } = renderHook(() => useInstanceSelection("radarr"), { wrapper });
    await vi.waitFor(() => {
      expect(result.current.typedInstances).toHaveLength(2);
    });
    expect(result.current.typedInstanceIds).toEqual([1, 2]);
  });

  it("defaults activeInstance to the first matching instance when nothing is in the URL", async () => {
    mockApi.get.mockResolvedValue([radarr1, radarr2, sonarr1]);
    const { result } = renderHook(() => useInstanceSelection("radarr"), { wrapper });
    await vi.waitFor(() => {
      expect(result.current.activeInstance).toBe(1);
    });
    expect(result.current.isAllMode).toBe(false);
    expect(result.current.helperInstance).toBe(1);
  });

  it("starts in all mode when the URL says ?instanceId=all", async () => {
    mockSearch.set("instanceId", "all");
    mockApi.get.mockResolvedValue([radarr1, radarr2]);
    const { result } = renderHook(() => useInstanceSelection("radarr"), { wrapper });
    expect(result.current.isAllMode).toBe(true);
    expect(result.current.activeInstance).toBe("all");
    await vi.waitFor(() => {
      expect(result.current.helperInstance).toBe(1);
    });
  });

  it("setInstanceId switches between numeric and 'all'", async () => {
    mockApi.get.mockResolvedValue([radarr1, radarr2]);
    const { result } = renderHook(() => useInstanceSelection("radarr"), { wrapper });
    await vi.waitFor(() => expect(result.current.typedInstances).toHaveLength(2));

    act(() => result.current.setInstanceId("all"));
    expect(result.current.isAllMode).toBe(true);

    act(() => result.current.setInstanceId(2));
    expect(result.current.isAllMode).toBe(false);
    expect(result.current.activeInstance).toBe(2);
  });
});
