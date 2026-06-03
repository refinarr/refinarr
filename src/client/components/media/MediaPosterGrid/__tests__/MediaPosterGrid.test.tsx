// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { defaultMediaFilters } from "@/client/hooks/media/useMediaFilters";
import type { MediaItem, MovieItem } from "@/shared/types/models";
import { renderWithProviders as render, screen } from "@/test/render";
import { MediaPosterGrid } from "../MediaPosterGrid";
import { PosterTile } from "../PosterTile";

interface Row {
  id: number;
  title: string;
}
const rows: Row[] = [
  { id: 1, title: "Alpha" },
  { id: 2, title: "Bravo" },
];

function gridProps(
  over: Partial<Parameters<typeof MediaPosterGrid<Row>>[0]> = {},
) {
  return {
    rows,
    selectedIds: new Set<number>(),
    onToggleSelect: vi.fn(),
    onRowClick: vi.fn(),
    renderPoster: (r: Row) => (
      <span data-testid={`tile-${r.id}`}>{r.title}</span>
    ),
    ...over,
  };
}

describe("MediaPosterGrid", () => {
  it("renders one tile per row via renderPoster", () => {
    render(<MediaPosterGrid {...gridProps()} />);
    expect(screen.getByTestId("media-poster-grid")).toBeInTheDocument();
    expect(screen.getByTestId("tile-1")).toBeInTheDocument();
    expect(screen.getByTestId("tile-2")).toBeInTheDocument();
  });

  it("clicking a tile body calls onRowClick with the id", async () => {
    const onRowClick = vi.fn();
    render(<MediaPosterGrid {...gridProps({ onRowClick })} />);
    await userEvent.click(screen.getByTestId("tile-1"));
    expect(onRowClick).toHaveBeenCalledWith(1);
  });

  it("clicking the checkbox toggles selection without opening the drawer", async () => {
    const onToggleSelect = vi.fn();
    const onRowClick = vi.fn();
    render(<MediaPosterGrid {...gridProps({ onToggleSelect, onRowClick })} />);
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);
    expect(onToggleSelect).toHaveBeenCalledWith(1);
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("fires fetchNextPage when the sentinel intersects", () => {
    const fetchNextPage = vi.fn();
    // happy-dom has no IntersectionObserver — stub one that fires
    // immediately so the hook's onLoadMore runs.
    const observe = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          // @ts-expect-error minimal stub
          cb([{ isIntersecting: true }]);
        }
        observe = observe;
        disconnect = vi.fn();
      },
    );
    render(
      <MediaPosterGrid {...gridProps({ fetchNextPage, hasNextPage: true })} />,
    );
    expect(fetchNextPage).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

// Minimal MovieItem stub — PosterTile reads score / file-presence /
// title / year off the MediaItem base.
function movie(over: Partial<MovieItem> = {}): MovieItem {
  return {
    id: 7,
    title: "The Thing",
    year: 1982,
    qualityProfileId: 1,
    customFormats: [],
    customFormatScore: 30,
    cfScore: 0.5,
    missingFormats: [],
    unwantedFormats: [],
    sizeOnDisk: 1024,
    monitored: true,
    existingFileCount: 1,
    totalFileCount: 1,
    flagged: false,
    movieFileId: 100,
    hasFile: true,
    ...over,
  };
}

// next-intl's translator is a complex callable (overloads + .rich/.raw/…)
// that can't be hand-built in a unit test, so the stub carries a single
// narrow cast. Everything else is a real value, so the object is now
// type-checked against MediaListShellRenderCtx — a dropped/renamed ctx
// field fails compilation instead of silently passing.
const tStub = ((key: string) => key) as MediaListShellRenderCtx<MediaItem>["t"];

function ctx(): MediaListShellRenderCtx<MediaItem> {
  return {
    arrType: "radarr",
    profiles: undefined,
    activeInstance: 3,
    queuedIds: new Set<number>(),
    recentMap: new Map<number, Date>(),
    density: "cozy",
    refetch: vi.fn(),
    runSearch: vi.fn(),
    runIgnore: vi.fn(),
    runDelete: vi.fn(),
    filters: defaultMediaFilters,
    onFilterChange: vi.fn(),
    cfOptions: { penalty: [] },
    t: tStub,
    tCols: tStub,
    tTime: tStub,
    tA11y: tStub,
  };
}

describe("PosterTile", () => {
  it("renders the proxy poster src, title and year", () => {
    render(<PosterTile item={movie()} ctx={ctx()} />);
    const img = screen.getByRole("img", { name: "The Thing" });
    expect(img).toHaveAttribute(
      "src",
      "/api/radarr/movies/poster?instanceId=3&mediaId=7",
    );
    expect(img).toHaveAttribute("loading", "lazy");
    expect(screen.getByText("1982")).toBeInTheDocument();
  });

  it("shows the profile score as current / cutoff", () => {
    render(
      <PosterTile
        item={movie({ customFormatScore: 30, minProfileScore: 100 })}
        ctx={ctx()}
      />,
    );
    expect(screen.getByText("30 / 100")).toBeInTheDocument();
  });

  it("falls back to a placeholder with the title when the image fails", () => {
    render(<PosterTile item={movie()} ctx={ctx()} />);
    fireEvent.error(screen.getByRole("img", { name: "The Thing" }));
    // The poster <img> is replaced by the placeholder (severity dot,
    // which is also role=img, stays — assert the poster specifically).
    expect(
      screen.queryByRole("img", { name: "The Thing" }),
    ).not.toBeInTheDocument();
    // Title shows twice now: the placeholder body + the caption below.
    expect(screen.getAllByText("The Thing")).toHaveLength(2);
  });
});
