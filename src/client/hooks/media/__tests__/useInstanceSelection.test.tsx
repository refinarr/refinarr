// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Live URLSearchParams instance — setInstanceId now writes via
// router.replace, and the test's mock router updates this object so
// the next hook re-render reflects the new query string. Mirrors how
// useSearchParams behaves in the real Next.js navigation flow.
const mockSearch = new URLSearchParams();
const mockReplace = vi.fn((path: string) => {
  const qs = path.includes("?") ? path.split("?")[1] : "";
  // Replace in place so existing `mockSearch` references stay valid.
  for (const k of Array.from(mockSearch.keys())) mockSearch.delete(k);
  for (const [k, v] of new URLSearchParams(qs).entries()) {
    mockSearch.set(k, v);
  }
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearch,
  usePathname: () => "/movies",
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

vi.mock("@/client/lib/api", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/client/lib/api";
import {
  useInstanceSelection,
  parseUrlInstance,
} from "../useInstanceSelection";

const mockApi = vi.mocked(api);

const radarr1 = {
  id: 1,
  type: "radarr",
  name: "Radarr-1",
  url: "http://x",
  enabled: true,
  createdAt: "",
};
const radarr2 = {
  id: 2,
  type: "radarr",
  name: "Radarr-2",
  url: "http://y",
  enabled: true,
  createdAt: "",
};
const sonarr1 = {
  id: 3,
  type: "sonarr",
  name: "Sonarr-1",
  url: "http://z",
  enabled: true,
  createdAt: "",
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("parseUrlInstance", () => {
  it.each([
    ["1", 1],
    ["42", 42],
    [null, 0],
    ["", 0],
    ["0", 0],
    ["-3", 0],
    ["abc", 0],
    ["all", 0],
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
    const { result } = renderHook(() => useInstanceSelection("radarr"), {
      wrapper,
    });
    await vi.waitFor(() => {
      expect(result.current.typedInstances).toHaveLength(2);
    });
    expect(result.current.typedInstanceIds).toEqual([1, 2]);
  });

  it("defaults activeInstance to the first matching instance when nothing is in the URL", async () => {
    mockApi.get.mockResolvedValue([radarr1, radarr2, sonarr1]);
    const { result } = renderHook(() => useInstanceSelection("radarr"), {
      wrapper,
    });
    await vi.waitFor(() => {
      expect(result.current.activeInstance).toBe(1);
    });
  });

  it("falls back to first instance when URL carries the legacy ?instanceId=all", async () => {
    mockSearch.set("instanceId", "all");
    mockApi.get.mockResolvedValue([radarr1, radarr2]);
    const { result } = renderHook(() => useInstanceSelection("radarr"), {
      wrapper,
    });
    await vi.waitFor(() => {
      expect(result.current.activeInstance).toBe(1);
    });
  });

  it("setInstanceId switches between instances", async () => {
    mockApi.get.mockResolvedValue([radarr1, radarr2]);
    const { result, rerender } = renderHook(
      () => useInstanceSelection("radarr"),
      { wrapper },
    );
    await vi.waitFor(() =>
      expect(result.current.typedInstances).toHaveLength(2),
    );

    // setInstanceId writes the URL via the mock router; the rerender
    // mirrors what Next.js does in production when searchParams change.
    act(() => result.current.setInstanceId(2));
    rerender();
    expect(result.current.activeInstance).toBe(2);

    act(() => result.current.setInstanceId(1));
    rerender();
    expect(result.current.activeInstance).toBe(1);
  });
});
