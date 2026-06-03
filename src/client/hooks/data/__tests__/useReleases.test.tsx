// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/client/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from "@/client/lib/api";
import { useReleases, useGrabRelease } from "../useReleases";

const mockApi = vi.mocked(api);

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("useReleases", () => {
  test("builds the radarr movie releases path", async () => {
    mockApi.get.mockResolvedValue([]);
    const { result } = renderHook(
      () => useReleases("radarr", 1, { kind: "movie", movieId: 42 }, true),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith(
      "/radarr/movies/releases?instanceId=1&movieId=42",
    );
  });

  test("builds the sonarr season releases path", async () => {
    mockApi.get.mockResolvedValue([]);
    const { result } = renderHook(
      () =>
        useReleases(
          "sonarr",
          5,
          { kind: "season", seriesId: 12, seasonNumber: 3 },
          true,
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith(
      "/sonarr/series/releases?instanceId=5&seriesId=12&seasonNumber=3",
    );
  });

  test("does not fetch while disabled (dialog closed)", () => {
    renderHook(
      () => useReleases("radarr", 1, { kind: "movie", movieId: 1 }, false),
      { wrapper },
    );
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe("useGrabRelease", () => {
  test("radarr posts to the movies grab endpoint", async () => {
    mockApi.post.mockResolvedValue({ id: 1, status: "grabbed" });
    const { result } = renderHook(() => useGrabRelease("radarr"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        instanceId: 1,
        mediaId: 42,
        guid: "g",
        indexerId: 7,
        title: "X",
      });
    });
    expect(mockApi.post).toHaveBeenCalledWith("/radarr/movies/grab", {
      instanceId: 1,
      mediaId: 42,
      guid: "g",
      indexerId: 7,
      title: "X",
    });
  });

  test("sonarr posts to the series grab endpoint", async () => {
    mockApi.post.mockResolvedValue({ id: 2, status: "grabbed" });
    const { result } = renderHook(() => useGrabRelease("sonarr"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        instanceId: 5,
        mediaId: 12,
        guid: "s",
        indexerId: 4,
        title: "Y",
      });
    });
    expect(mockApi.post).toHaveBeenCalledWith(
      "/sonarr/series/grab",
      expect.objectContaining({ instanceId: 5, mediaId: 12 }),
    );
  });

  test("invalidates the history query after a successful grab", async () => {
    mockApi.post.mockResolvedValue({ id: 1, status: "grabbed" });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useGrabRelease("radarr"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        instanceId: 1,
        mediaId: 42,
        guid: "g",
        indexerId: 7,
        title: "X",
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["history"] });
  });
});
