// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import type { PublicInstance } from "@/shared/types/api";
import type { useAutoSearchStatus } from "@/client/hooks/data/useAutoSearch";
import { renderWithProviders } from "@/test/render";
import { AutoSearchSection } from "../AutoSearchSection";

const { mockTriggerMutateAsync, mockUpdateMutateAsync } = vi.hoisted(() => ({
  mockTriggerMutateAsync: vi.fn().mockResolvedValue({ enqueued: 3 }),
  mockUpdateMutateAsync: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/client/hooks/data/useAutoSearch", () => ({
  useAutoSearchStatus: vi
    .fn()
    .mockReturnValue({ data: null, isLoading: false }),
  useTriggerAutoSearch: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: mockTriggerMutateAsync,
    isPending: false,
  }),
  useCronPreview: vi.fn().mockReturnValue({ data: null, isError: false }),
}));

vi.mock("@/client/hooks/data/useInstances", () => ({
  useUpdateInstance: vi.fn().mockReturnValue({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/client/lib/with-toast", () => ({
  withToast: vi.fn((mutation) => () => mutation.mutateAsync()),
}));

vi.mock("@/client/hooks/ui/useDebouncedValue", () => ({
  useDebouncedValue: vi.fn((value: unknown) => value),
}));

const baseInstance: PublicInstance = {
  id: 1,
  type: "radarr",
  name: "Test Radarr",
  url: "http://localhost:7878",
  enabled: true,
  scoringMode: "profile",
  searchesPerHour: 20,
  showAllMedia: false,
  createdAt: "2025-01-01T00:00:00Z",
  autoSearchEnabled: false,
  autoSearchScheduleMode: "interval",
  autoSearchIntervalMinutes: 1440,
  autoSearchCronExpression: "0 3 * * *",
  autoSearchBatchLimit: 5,
  autoSearchLastRunAt: null,
  autoSearchMonitoredOnly: true,
  autoSearchScope: "flagged",
  autoSearchPickStrategy: "balanced",
};

// Shared status shape used across tests that need enabled status.
const enabledStatus = {
  enabled: true,
  scheduleMode: "interval" as const,
  intervalMinutes: 1440,
  cronExpression: "0 3 * * *",
  cronValid: true,
  batchLimit: 5,
  monitoredOnly: true,
  scope: "flagged" as const,
  lastRunAt: null,
  nextRunAt: null,
  running: false,
} satisfies ReturnType<typeof useAutoSearchStatus>["data"] & object;

describe("AutoSearchSection", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset useAutoSearchStatus to the default null state so tests that
    // override it don't bleed into the next test (clearAllMocks resets call
    // counts but not mockReturnValue implementations).
    const { useAutoSearchStatus: mockStatus } = await import(
      "@/client/hooks/data/useAutoSearch"
    );
    vi.mocked(mockStatus).mockReturnValue({ data: null, isLoading: false });
    mockTriggerMutateAsync.mockResolvedValue({ enqueued: 3 });
    mockUpdateMutateAsync.mockResolvedValue({});
  });

  test("renders collapsed by default when autoSearchEnabled is false", () => {
    renderWithProviders(<AutoSearchSection instance={baseInstance} />);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  test("shows 'Off' label when collapsed and disabled", () => {
    renderWithProviders(<AutoSearchSection instance={baseInstance} />);
    expect(screen.getByText(/off/i)).toBeInTheDocument();
  });

  test("renders expanded by default when autoSearchEnabled is true", () => {
    renderWithProviders(
      <AutoSearchSection
        instance={{ ...baseInstance, autoSearchEnabled: true }}
      />,
    );
    expect(screen.getAllByRole("switch").length).toBeGreaterThanOrEqual(1);
  });

  test("clicking the header toggles the section open", () => {
    renderWithProviders(<AutoSearchSection instance={baseInstance} />);
    const header = screen.getByRole("button");
    expect(screen.queryByRole("switch")).toBeNull();
    fireEvent.click(header);
    expect(screen.getAllByRole("switch").length).toBeGreaterThanOrEqual(1);
  });

  test("clicking the header again collapses the section", () => {
    renderWithProviders(<AutoSearchSection instance={baseInstance} />);
    const header = screen.getByRole("button");
    fireEvent.click(header);
    expect(screen.getAllByRole("switch").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(header);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  test("Run now button not shown when autoSearch toggle is off", () => {
    renderWithProviders(<AutoSearchSection instance={baseInstance} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText(/run now/i)).toBeNull();
  });

  test("status panel shows Run now button when enabled", async () => {
    const { useAutoSearchStatus } = await import(
      "@/client/hooks/data/useAutoSearch"
    );
    vi.mocked(useAutoSearchStatus).mockReturnValue({
      data: enabledStatus,
      isLoading: false,
    });

    renderWithProviders(
      <AutoSearchSection
        instance={{ ...baseInstance, autoSearchEnabled: true }}
      />,
    );

    expect(
      await screen.findByRole("button", { name: /run now/i }),
    ).toBeInTheDocument();
  });

  test("status panel shows last run and next run from GET response", async () => {
    const { useAutoSearchStatus } = await import(
      "@/client/hooks/data/useAutoSearch"
    );
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    vi.mocked(useAutoSearchStatus).mockReturnValue({
      data: { ...enabledStatus, lastRunAt: past, nextRunAt: future },
      isLoading: false,
    });

    renderWithProviders(
      <AutoSearchSection
        instance={{ ...baseInstance, autoSearchEnabled: true }}
      />,
    );

    await waitFor(() => {
      // "Last run: <time>" and "Next: in <eta>" come from the status panel
      expect(screen.getByText(/last run/i)).toBeInTheDocument();
      expect(screen.getByText(/next/i)).toBeInTheDocument();
    });
  });

  test("shows 'Running now' indicator when status.running is true", async () => {
    const { useAutoSearchStatus } = await import(
      "@/client/hooks/data/useAutoSearch"
    );
    vi.mocked(useAutoSearchStatus).mockReturnValue({
      data: { ...enabledStatus, running: true },
      isLoading: false,
    });

    renderWithProviders(
      <AutoSearchSection
        instance={{ ...baseInstance, autoSearchEnabled: true }}
      />,
    );

    expect(await screen.findByText(/running now/i)).toBeInTheDocument();
  });

  test("Run now button calls trigger mutation", async () => {
    const { useAutoSearchStatus } = await import(
      "@/client/hooks/data/useAutoSearch"
    );
    vi.mocked(useAutoSearchStatus).mockReturnValue({
      data: enabledStatus,
      isLoading: false,
    });

    renderWithProviders(
      <AutoSearchSection
        instance={{ ...baseInstance, autoSearchEnabled: true }}
      />,
    );

    const runBtn = await screen.findByRole("button", { name: /run now/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(mockTriggerMutateAsync).toHaveBeenCalled();
    });
  });

  test("field change triggers auto-save via useUpdateInstance", async () => {
    // useDebouncedValue is mocked to pass through immediately (no real delay).
    renderWithProviders(<AutoSearchSection instance={baseInstance} />);

    fireEvent.click(screen.getByRole("button"));

    // Toggle the enable switch (autoSearchEnabled: false → true).
    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: baseInstance.id,
          data: expect.objectContaining({ autoSearchEnabled: true }),
        }),
      );
    });
  });
});
