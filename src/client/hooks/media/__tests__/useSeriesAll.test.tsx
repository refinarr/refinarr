// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

vi.mock("@/client/lib/api", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/client/lib/api";
import { useSeriesAll } from "../useSeriesAll";

const mockApi = vi.mocked(api);

function makeSeries(instanceId: number, id: number, title: string) {
  return {
    id,
    title,
    year: 2024,
    qualityProfileId: 1,
    customFormats: [],
    customFormatScore: 0,
    cfScore: 0,
    missingFormats: [],
    unwantedFormats: [],
    sizeOnDisk: 1_000_000_000,
    minProfileScore: 0,
    addedAt: new Date().toISOString(),
    episodeFiles: [],
    affectedEpisodeCount: 0,
    totalEpisodeCount: 10,
    instanceId,
  };
}

interface ProbeProps {
  ids: number[];
}

function Probe({ ids }: ProbeProps) {
  const r = useSeriesAll(ids);
  return (
    <pre data-testid="result">
      {JSON.stringify({
        total: r.total,
        truncated: r.truncated,
        isLoading: r.isLoading,
        series: r.allSeries.map((s) => ({ id: s.id, instanceId: s.__instanceId, title: s.title })),
      })}
    </pre>
  );
}

function renderWithQuery(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("useSeriesAll", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
  });

  it("returns empty + non-loading when instanceIds is empty (no queries fire)", () => {
    renderWithQuery(<Probe ids={[]} />);
    const r = JSON.parse(screen.getByTestId("result").textContent ?? "{}");
    expect(r.total).toBe(0);
    expect(r.isLoading).toBe(false);
    expect(r.series).toEqual([]);
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("aggregates items across instances and annotates each with __instanceId", async () => {
    mockApi.get.mockImplementation(async (path: string) => {
      const url = new URL(`http://x${path}`);
      const id = Number(url.searchParams.get("instanceId"));
      return {
        items: [makeSeries(id, id * 100, `Show ${id}`)],
        total: 1,
        page: 1,
        limit: 200,
        hasMore: false,
      };
    });

    renderWithQuery(<Probe ids={[1, 3]} />);
    await waitFor(() => {
      const r = JSON.parse(screen.getByTestId("result").textContent ?? "{}");
      expect(r.isLoading).toBe(false);
      expect(r.series).toHaveLength(2);
    });

    const r = JSON.parse(screen.getByTestId("result").textContent ?? "{}");
    expect(r.series.find((s: { instanceId: number }) => s.instanceId === 1)).toMatchObject({
      title: "Show 1",
    });
    expect(r.series.find((s: { instanceId: number }) => s.instanceId === 3)).toMatchObject({
      title: "Show 3",
    });
    expect(r.truncated).toBe(false);
  });

  it("sets truncated=true when any instance reports hasMore", async () => {
    mockApi.get.mockImplementation(async (path: string) => {
      const url = new URL(`http://x${path}`);
      const id = Number(url.searchParams.get("instanceId"));
      return {
        items: [makeSeries(id, id * 100, `Show ${id}`)],
        total: id === 1 ? 350 : 1,
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
    expect(r.total).toBe(351);
  });
});
