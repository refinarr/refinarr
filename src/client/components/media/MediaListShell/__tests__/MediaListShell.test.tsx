// @vitest-environment happy-dom
import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import messages from "../../../../../../messages/en.json";
import type { FlaggedMovie } from "@/shared/types/models";
import type { FlaggedMediaQueryHook } from "@/client/hooks/media/useFlaggedMediaData";
import { MOVIE_BULK_CONFIG } from "../../media-bulk-configs";

function renderWithShellProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

// Mock heavy data/state hooks used inside the shell so the component is
// rendered in isolation without spinning up a TanStack QueryClient or DB.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/movies",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/client/hooks/media/useInstanceSelection", () => ({
  useInstanceSelection: () => ({
    instances: [{ id: 1, name: "My Radarr" }],
    typedInstances: [{ id: 1, name: "My Radarr", scoringMode: "manual", type: "radarr" }],
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

const baseMovie: FlaggedMovie = {
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
};

function makeUseQuery(items: FlaggedMovie[] = []): FlaggedMediaQueryHook<FlaggedMovie> {
  return () => ({
    data: items.length > 0 ? { pages: [{ items, total: items.length }] } : undefined,
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
    renderWithShellProviders(
      <MediaListShell<FlaggedMovie>
        arrType="radarr"
        bulkConfig={MOVIE_BULK_CONFIG}
        useQuery={makeUseQuery([])}
        columns={() => []}
        renderCard={() => null}
        renderDrawer={() => null}
        i18nNamespace="movies"
        confirmDeleteBulkKey="confirm.deleteMovies"
      />,
    );
    // Empty state surfaces an "All clear" message when there are no items
    // and no active filters.
    expect(screen.getByText(/all clear/i)).toBeInTheDocument();
  });

  it("invokes the columns + renderCard factories with ctx when items load", () => {
    const columns = vi.fn().mockReturnValue([]);
    const renderCard = vi.fn().mockReturnValue(null);

    renderWithShellProviders(
      <MediaListShell<FlaggedMovie>
        arrType="radarr"
        bulkConfig={MOVIE_BULK_CONFIG}
        useQuery={makeUseQuery([baseMovie])}
        columns={columns}
        renderCard={renderCard}
        renderDrawer={() => null}
        i18nNamespace="movies"
        confirmDeleteBulkKey="confirm.deleteMovies"
      />,
    );

    expect(columns).toHaveBeenCalled();
    const ctx = columns.mock.calls[0][0];
    expect(ctx.arrType).toBe("radarr");
    expect(ctx.activeInstance).toBe(1);
    expect(ctx.scoringMode).toBe("manual");
    // The renderCard factory is invoked once per row when the table mounts.
    expect(renderCard).toHaveBeenCalledWith(baseMovie, expect.any(Object));
  });

  it("invokes renderDrawer with the current selection (initially null)", () => {
    const renderDrawer = vi.fn().mockReturnValue(null);

    renderWithShellProviders(
      <MediaListShell<FlaggedMovie>
        arrType="radarr"
        bulkConfig={MOVIE_BULK_CONFIG}
        useQuery={makeUseQuery([baseMovie])}
        columns={() => []}
        renderCard={() => null}
        renderDrawer={renderDrawer}
        i18nNamespace="movies"
        confirmDeleteBulkKey="confirm.deleteMovies"
      />,
    );

    expect(renderDrawer).toHaveBeenCalled();
    const [item, ctx] = renderDrawer.mock.calls[0];
    expect(item).toBeNull();
    expect(ctx.activeInstance).toBe(1);
  });
});
