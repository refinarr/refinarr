// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/client/lib/api", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/client/lib/api";
import type { SystemInfo } from "@/shared/types/api";
import { useSystem, useRefreshSystem } from "../useSystem";

const mockApi = vi.mocked(api);

const fakeSystem: SystemInfo = {
  version: "0.1.0",
  bootedAtMs: Date.now() - 60_000,
  node: "v22.15.0",
  platform: "darwin/arm64",
  latestRelease: {
    tag: "v0.1.0",
    htmlUrl: "https://example/r",
    checkedAtMs: Date.now(),
    isStale: false,
  },
};

// QueryClient must be stable across renders so `setQueryData` in the
// mutation success path is visible to useSystem's next read. The
// shared-per-test pattern from React Query's docs.
let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockApi.get.mockReset();
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

describe("useSystem", () => {
  test("fetches /system on mount", async () => {
    mockApi.get.mockResolvedValue(fakeSystem);
    const { result } = renderHook(() => useSystem(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(fakeSystem));
    expect(mockApi.get).toHaveBeenCalledWith("/system");
  });

  test("surfaces loading + error states", async () => {
    mockApi.get.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useSystem(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useRefreshSystem", () => {
  test("posts to /system?refresh=1 and updates the cached snapshot", async () => {
    mockApi.get.mockResolvedValueOnce(fakeSystem);
    const { result } = renderHook(
      () => ({ system: useSystem(), refresh: useRefreshSystem() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.system.data).toEqual(fakeSystem));

    const next: SystemInfo = {
      ...fakeSystem,
      latestRelease: {
        tag: "v0.2.0",
        htmlUrl: "https://example/r2",
        checkedAtMs: Date.now(),
        isStale: false,
      },
    };
    mockApi.get.mockResolvedValueOnce(next);

    await act(async () => {
      await result.current.refresh.mutateAsync();
    });
    expect(mockApi.get).toHaveBeenLastCalledWith("/system?refresh=1");
    // setQueryData path — wait for the snapshot to propagate to
    // useSystem's next read (React Query batches the update across
    // the cache subscribers).
    await waitFor(() =>
      expect(result.current.system.data?.latestRelease?.tag).toBe("v0.2.0"),
    );
  });
});
