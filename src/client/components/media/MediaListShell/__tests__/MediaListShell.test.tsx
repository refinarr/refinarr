// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { MediaDataQueryHook } from "@/client/hooks/media/useMediaData";
import type { MovieItem } from "@/shared/types/models";
import { renderWithProviders } from "@/test/render";
import { MOVIE_BULK_CONFIG } from "../../media-bulk-configs";

// Tests interact with the Card render path inside MediaTable, which
// gates desktop vs mobile via matchMedia. Force mobile so the Card prop
// (renderCard) is invoked — the assertions here are about ctx wiring,
// not which layout path renders.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

// Mock heavy data/state hooks used inside the shell so the component is
// rendered in isolation without spinning up a TanStack QueryClient or DB.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/movies",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/client/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/client/hooks/media/useInstanceSelection", () => ({
  useInstanceSelection: () => ({
    instances: [{ id: 1, name: "My Radarr" }],
    typedInstances: [
      { id: 1, name: "My Radarr", scoringMode: "manual", type: "radarr" },
    ],
    activeInstance: 1,
    setInstanceId: vi.fn(),
    loadingInstances: false,
  }),
}));

vi.mock("@/client/hooks/data/usePreferences", () => ({
  usePreferences: () => ({ data: [{ cfId: 10, cfName: "HDR10" }] }),
}));

vi.mock("@/client/hooks/data/useQualityProfiles", () => ({
  useQualityProfiles: () => ({ data: [] }),
}));

vi.mock("@/client/hooks/data/useRefreshInstance", () => ({
  useRefreshInstance: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/client/hooks/data/useSearchQueue", () => ({
  useQueuedMediaIds: () => new Set<number>(),
}));

vi.mock("@/client/hooks/data/useRecentSearches", () => ({
  useRecentSearchMap: () => new Map<number, Date>(),
}));

vi.mock("@/client/hooks/ui/useInfiniteScroll", () => ({
  useInfiniteScroll: () => ({ current: null }),
}));

vi.mock("@/client/hooks/media/useBulkAbort", () => ({
  useBulkAbort: () => ({ cancel: vi.fn(), signal: undefined }),
}));

vi.mock("@/client/hooks/media/useBulkMediaActions", () => ({
  useBulkMediaActions: () => ({
    searchMutation: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
    deleteMutation: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
    ignoreWithToast: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/client/hooks/media/useBulkHandlers", () => ({
  useBulkHandlers: () => ({
    handleSearch: vi.fn(),
    handleDelete: vi.fn(),
    handleIgnore: vi.fn(),
  }),
}));

import { MediaListShell } from "../MediaListShell";

const baseMovie: MovieItem = {
  id: 7,
  title: "Test Movie",
  year: 2024,
  qualityProfileId: 1,
  movieFileId: 42,
  customFormats: [],
  customFormatScore: 0,
  hasFile: true,
  cfScore: 0.5,
  missingFormats: [],
  unwantedFormats: [],
  sizeOnDisk: 0,
  monitored: true,
  existingFileCount: 1,
  totalFileCount: 1,
  flagged: true,
};

function makeUseQuery(items: MovieItem[] = []): MediaDataQueryHook<MovieItem> {
  return () => ({
    data:
      items.length > 0
        ? { pages: [{ items, total: items.length }] }
        : undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    refetch: vi.fn(),
  });
}

describe("MediaListShell", () => {
  it("renders the empty state when no items match", () => {
    renderWithProviders(
      <MediaListShell
        arrType="radarr"
        bulkConfig={MOVIE_BULK_CONFIG}
        useQuery={makeUseQuery([])}
        i18nNamespace="movies"
        confirmDeleteBulkKey="confirm.deleteMovies"
      >
        <MediaListShell.Body<MovieItem>
          tableId="test"
          columns={() => []}
          Card={() => null}
        />
        <MediaListShell.Drawer<MovieItem> as={() => null} />
      </MediaListShell>,
    );
    expect(screen.getByText(/all clear/i)).toBeInTheDocument();
  });

  it("invokes the columns factory + Card component with ctx when items load", () => {
    const columns = vi.fn().mockReturnValue([]);
    const Card = vi.fn().mockReturnValue(null);

    renderWithProviders(
      <MediaListShell
        arrType="radarr"
        bulkConfig={MOVIE_BULK_CONFIG}
        useQuery={makeUseQuery([baseMovie])}
        i18nNamespace="movies"
        confirmDeleteBulkKey="confirm.deleteMovies"
      >
        <MediaListShell.Body<MovieItem>
          tableId="test"
          columns={columns}
          Card={Card}
        />
      </MediaListShell>,
    );

    expect(columns).toHaveBeenCalled();
    const ctx = columns.mock.calls[0][0];
    expect(ctx.arrType).toBe("radarr");
    expect(ctx.activeInstance).toBe(1);
    expect(ctx.scoringMode).toBe("manual");
    expect(Card).toHaveBeenCalled();
    const cardProps = Card.mock.calls[0][0];
    expect(cardProps.item).toEqual(baseMovie);
    expect(cardProps.ctx.activeInstance).toBe(1);
  });

  it("renders the Drawer with the current selection (initially null)", () => {
    const Drawer = vi.fn().mockReturnValue(null);

    renderWithProviders(
      <MediaListShell
        arrType="radarr"
        bulkConfig={MOVIE_BULK_CONFIG}
        useQuery={makeUseQuery([baseMovie])}
        i18nNamespace="movies"
        confirmDeleteBulkKey="confirm.deleteMovies"
      >
        <MediaListShell.Drawer<MovieItem> as={Drawer} />
      </MediaListShell>,
    );

    expect(Drawer).toHaveBeenCalled();
    const props = Drawer.mock.calls[0][0];
    expect(props.item).toBeNull();
    expect(props.ctx.activeInstance).toBe(1);
    expect(typeof props.close).toBe("function");
  });
});
