// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/client/lib/api", () => ({
  api: { get: vi.fn(), delete: vi.fn() },
}));

import { api } from "@/client/lib/api";
import type { CacheStatsSnapshot } from "@/shared/types/api";
import { useCacheStats, useClearCache } from "../useCacheStats";

const mockApi = vi.mocked(api);

const fakeSnapshot: CacheStatsSnapshot = {
  entries: 5,
  maxEntries: 200,
  sizeBytes: 1024,
  maxSizeBytes: 50 * 1024 * 1024,
  hits: 100,
  misses: 5,
  evictions: 0,
  inflightCount: 0,
  oldestEntryAtMs: 60_000,
  lastInvalidatedAtMs: null,
};

interface WrapperProps {
  children: ReactNode;
}

function wrapper({ children }: WrapperProps) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.delete.mockReset();
});

describe("useCacheStats", () => {
  test("fetches the snapshot on mount", async () => {
    mockApi.get.mockResolvedValue(fakeSnapshot);
    const { result } = renderHook(() => useCacheStats(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(fakeSnapshot));
    expect(mockApi.get).toHaveBeenCalledWith("/diagnostics/cache");
  });

  test("exposes loading state before the first response settles", () => {
    mockApi.get.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useCacheStats(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  test("surfaces error state when the API rejects", async () => {
    mockApi.get.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useCacheStats(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useClearCache", () => {
  test("calls DELETE /diagnostics/cache and invalidates the snapshot query", async () => {
    mockApi.get.mockResolvedValue(fakeSnapshot);
    mockApi.delete.mockResolvedValue({ ok: true });

    const { result } = renderHook(
      () => ({ stats: useCacheStats(), clear: useClearCache() }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.stats.data).toEqual(fakeSnapshot),
    );

    // After the mutation runs, the stats query is invalidated → useCacheStats
    // refetches. Mock the next get with an empty-cache snapshot so we can see
    // the invalidation actually propagated.
    mockApi.get.mockResolvedValue({ ...fakeSnapshot, entries: 0 });
    await act(async () => {
      await result.current.clear.mutateAsync();
    });
    expect(mockApi.delete).toHaveBeenCalledWith("/diagnostics/cache");
    await waitFor(() => expect(result.current.stats.data?.entries).toBe(0));
  });
});
