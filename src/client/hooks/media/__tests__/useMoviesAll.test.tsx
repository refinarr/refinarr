// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

vi.mock("@/client/lib/api", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/client/lib/api";
import { useMoviesAll } from "../useMoviesAll";

const mockApi = vi.mocked(api);

function makeMovie(instanceId: number, id: number, title: string) {
  return {
    id,
    title,
    year: 2024,
    qualityProfileId: 1,
    movieFileId: id,
    customFormats: [],
    customFormatScore: 0,
    hasFile: true,
    cfScore: 0,
    missingFormats: [],
    unwantedFormats: [],
    sizeOnDisk: 1_000_000_000,
    minProfileScore: 0,
    addedAt: new Date().toISOString(),
    instanceId,
  };
}

interface ProbeProps {
  ids: number[];
}

function Probe({ ids }: ProbeProps) {
  const r = useMoviesAll(ids);
  return (
    <pre data-testid="result">
      {JSON.stringify({
        total: r.total,
        truncated: r.truncated,
        isLoading: r.isLoading,
        isError: r.isError,
        movies: r.allMovies.map((m) => ({ id: m.id, instanceId: m.__instanceId, title: m.title })),
      })}
    </pre>
  );
}

function renderWithQuery(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("useMoviesAll", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
  });

  it("returns empty + non-loading when instanceIds is empty (no queries fire)", () => {
    renderWithQuery(<Probe ids={[]} />);
    const r = JSON.parse(screen.getByTestId("result").textContent ?? "{}");
    expect(r.total).toBe(0);
    expect(r.isLoading).toBe(false);
    expect(r.movies).toEqual([]);
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("aggregates items across instances and annotates each with __instanceId", async () => {
    mockApi.get.mockImplementation(async (path: string) => {
      const url = new URL(`http://x${path}`);
      const id = Number(url.searchParams.get("instanceId"));
      return {
        items: [makeMovie(id, id * 100, `From ${id}`)],
        total: 1,
        page: 1,
        limit: 200,
        hasMore: false,
      };
    });

    renderWithQuery(<Probe ids={[1, 2]} />);
    await waitFor(() => {
      const r = JSON.parse(screen.getByTestId("result").textContent ?? "{}");
      expect(r.isLoading).toBe(false);
      expect(r.movies).toHaveLength(2);
    });

    const r = JSON.parse(screen.getByTestId("result").textContent ?? "{}");
    expect(r.movies.find((m: { instanceId: number }) => m.instanceId === 1)).toMatchObject({
      title: "From 1",
      instanceId: 1,
    });
    expect(r.movies.find((m: { instanceId: number }) => m.instanceId === 2)).toMatchObject({
      title: "From 2",
      instanceId: 2,
    });
    expect(r.total).toBe(2);
    expect(r.truncated).toBe(false);
  });

  it("sets truncated=true when any instance reports hasMore", async () => {
    mockApi.get.mockImplementation(async (path: string) => {
      const url = new URL(`http://x${path}`);
      const id = Number(url.searchParams.get("instanceId"));
      return {
        items: [makeMovie(id, id * 100, `From ${id}`)],
        total: id === 1 ? 500 : 1,
        page: 1,
        limit: 200,
        hasMore: id === 1,
      };
    });

    renderWithQuery(<Probe ids={[1, 2]} />);
    await waitFor(() => {
      const r = JSON.parse(screen.getByTestId("result").textContent ?? "{}");
      expect(r.isLoading).toBe(false);
    });

    const r = JSON.parse(screen.getByTestId("result").textContent ?? "{}");
    expect(r.truncated).toBe(true);
    // total reflects the upstream-reported counts across instances (500 + 1)
    expect(r.total).toBe(501);
  });
});
