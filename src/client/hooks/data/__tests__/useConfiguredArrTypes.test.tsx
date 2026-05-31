// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/client/lib/api", () => ({ api: { get: vi.fn() } }));

import { api } from "@/client/lib/api";
import { useConfiguredArrTypes } from "../useInstances";

const mockApi = vi.mocked(api);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe("useConfiguredArrTypes (#53)", () => {
  test("returns only arr types that have a configured instance", async () => {
    mockApi.get.mockResolvedValue([{ id: 1, type: "radarr", name: "R" }]);
    const { result } = renderHook(() => useConfiguredArrTypes(), { wrapper });
    await waitFor(() => expect(result.current).toEqual(["radarr"]));
  });

  test("falls back to all supported types when no instances exist", async () => {
    mockApi.get.mockResolvedValue([]);
    const { result } = renderHook(() => useConfiguredArrTypes(), { wrapper });
    await waitFor(() => expect(result.current).toEqual(["radarr", "sonarr"]));
  });

  test("returns both types in canonical order regardless of instance order", async () => {
    mockApi.get.mockResolvedValue([
      { id: 2, type: "sonarr", name: "S" },
      { id: 1, type: "radarr", name: "R" },
    ]);
    const { result } = renderHook(() => useConfiguredArrTypes(), { wrapper });
    await waitFor(() => expect(result.current).toEqual(["radarr", "sonarr"]));
  });
});
