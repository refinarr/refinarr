// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReleaseCandidate } from "@/shared/types/api";
import { renderWithProviders } from "@/test/render";
import { ReleasePickerDialog } from "../ReleasePickerDialog";

const { mockUseReleases, mockGrabMutateAsync, toastSuccess, toastError } =
  vi.hoisted(() => ({
    mockUseReleases: vi.fn(),
    mockGrabMutateAsync: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }));

vi.mock("@/client/hooks/data/useReleases", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/client/hooks/data/useReleases")>();
  return {
    ...actual,
    useReleases: (...args: unknown[]) => mockUseReleases(...args),
    useGrabRelease: () => ({ mutateAsync: mockGrabMutateAsync }),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

function release(overrides: Partial<ReleaseCandidate> = {}): ReleaseCandidate {
  return {
    guid: "g1",
    indexerId: 7,
    indexer: "NZBgeek",
    title: "Movie.2024.2160p.BluRay",
    protocol: "usenet",
    quality: "Bluray-2160p",
    size: 1024 * 1024 * 1024,
    seeders: null,
    customFormats: [{ id: 10, name: "HDR", score: 50 }],
    customFormatScore: 150,
    rejections: [],
    downloadAllowed: true,
    ...overrides,
  };
}

function setReleases(
  result: Partial<ReturnType<typeof mockUseReleases>> & {
    data?: ReleaseCandidate[];
  },
) {
  mockUseReleases.mockReturnValue({
    data: result.data,
    isLoading: result.isLoading ?? false,
    isError: result.isError ?? false,
    refetch: vi.fn(),
  });
}

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  arrType: "radarr" as const,
  instanceId: 1,
  title: "My Movie",
  target: { kind: "movie" as const, movieId: 42 },
};

beforeEach(() => {
  mockUseReleases.mockReset();
  mockGrabMutateAsync.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  baseProps.onOpenChange.mockReset?.();
});

describe("ReleasePickerDialog", () => {
  test("renders one row per release with quality + size + CF badge", () => {
    setReleases({
      data: [
        release({ title: "First" }),
        release({ guid: "g2", title: "Second" }),
      ],
    });
    renderWithProviders(<ReleasePickerDialog {...baseProps} />);
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
    expect(screen.getAllByText("Bluray-2160p")).toHaveLength(2);
    expect(screen.getAllByText("HDR").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Score 150/).length).toBe(2);
  });

  test("shows the empty state when the release list is empty", () => {
    setReleases({ data: [] });
    renderWithProviders(<ReleasePickerDialog {...baseProps} />);
    expect(screen.getByText("No releases found.")).toBeTruthy();
  });

  test("shows the loading spinner text while fetching", () => {
    setReleases({ isLoading: true });
    renderWithProviders(<ReleasePickerDialog {...baseProps} />);
    expect(screen.getByText("Searching indexers…")).toBeTruthy();
  });

  test("a rejected release shows its rejection text and a disabled Grab button", () => {
    setReleases({
      data: [
        release({
          downloadAllowed: false,
          rejections: ["Not a custom format upgrade"],
        }),
      ],
    });
    renderWithProviders(<ReleasePickerDialog {...baseProps} />);
    expect(screen.getByText(/Not a custom format upgrade/)).toBeTruthy();
    const grabBtn = screen.getByRole("button", { name: /grab/i });
    expect((grabBtn as HTMLButtonElement).disabled).toBe(true);
  });

  test("clicking Grab on an allowed release calls the mutation and fires a success toast", async () => {
    mockGrabMutateAsync.mockResolvedValue({ isDryRun: false });
    setReleases({ data: [release()] });
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ReleasePickerDialog {...baseProps} onOpenChange={onOpenChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /grab/i }));
    await waitFor(() =>
      expect(mockGrabMutateAsync).toHaveBeenCalledWith({
        instanceId: 1,
        mediaId: 42,
        guid: "g1",
        indexerId: 7,
        title: "My Movie",
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Release grabbed", undefined);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test("a dry-run grab fires the dry-run toast copy", async () => {
    mockGrabMutateAsync.mockResolvedValue({ isDryRun: true });
    setReleases({ data: [release()] });
    renderWithProviders(<ReleasePickerDialog {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: /grab/i }));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Grab queued (dry run)",
        undefined,
      ),
    );
  });

  test("passes the season target's seriesId as mediaId when grabbing", async () => {
    mockGrabMutateAsync.mockResolvedValue({ isDryRun: false });
    setReleases({ data: [release()] });
    renderWithProviders(
      <ReleasePickerDialog
        {...baseProps}
        arrType="sonarr"
        title="My Show — Season 3"
        target={{ kind: "season", seriesId: 12, seasonNumber: 3 }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /grab/i }));
    await waitFor(() =>
      expect(mockGrabMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ mediaId: 12, title: "My Show — Season 3" }),
      ),
    );
  });

  test("a failed grab fires the error toast and keeps the dialog open", async () => {
    mockGrabMutateAsync.mockRejectedValue(new Error("boom"));
    setReleases({ data: [release()] });
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ReleasePickerDialog {...baseProps} onOpenChange={onOpenChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /grab/i }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Couldn't grab release",
        undefined,
      ),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test("disables every Grab while one is in flight (prevents duplicate grabs)", async () => {
    // A never-resolving grab keeps the in-flight state active so we can
    // assert the other rows are locked out.
    let resolveGrab: (v: { isDryRun: boolean }) => void = () => {};
    mockGrabMutateAsync.mockReturnValue(
      new Promise<{ isDryRun: boolean }>((res) => {
        resolveGrab = res;
      }),
    );
    setReleases({
      data: [
        release({ guid: "g1", title: "First" }),
        release({ guid: "g2", title: "Second" }),
      ],
    });
    renderWithProviders(<ReleasePickerDialog {...baseProps} />);
    const grabButtons = screen.getAllByRole("button", { name: /grab/i });
    expect(grabButtons).toHaveLength(2);

    await userEvent.click(grabButtons[0]);
    await waitFor(() => {
      for (const btn of screen.getAllByRole("button", { name: /grab/i })) {
        expect((btn as HTMLButtonElement).disabled).toBe(true);
      }
    });
    // Only the one grab fired even though a second button exists.
    expect(mockGrabMutateAsync).toHaveBeenCalledTimes(1);

    resolveGrab({ isDryRun: false });
  });
});
