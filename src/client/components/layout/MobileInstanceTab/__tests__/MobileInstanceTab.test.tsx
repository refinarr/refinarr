// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent } from "@testing-library/react";
import { Film } from "lucide-react";
import type { PublicInstance } from "@/shared/types/api";
import { renderWithProviders, screen } from "@/test/render";
import { MobileInstanceTab } from "../MobileInstanceTab";

let mockPathname = "/movies";
let mockSearchParams = "";
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

let mockInstances: PublicInstance[] | undefined;

vi.mock("@/client/hooks/data/useInstances", () => ({
  useInstances: () => ({ data: mockInstances }),
  useInstanceHealth: () => ({ data: undefined, isLoading: true }),
}));

const baseInstance: Omit<PublicInstance, "id" | "name" | "url" | "type"> = {
  enabled: true,
  searchesPerHour: 100,
  showAllMedia: false,
  createdAt: new Date(),
  autoSearchEnabled: false,
  autoSearchScheduleMode: "interval",
  autoSearchIntervalMinutes: 1440,
  autoSearchCronExpression: "0 3 * * *",
  autoSearchBatchLimit: 5,
  autoSearchLastRunAt: null,
  autoSearchMonitoredOnly: true,
  autoSearchScope: "flagged",
  autoSearchPickStrategy: "balanced",
  autoSearchCooldownHours: 0,
  autoSearchPausedUntil: null,
};

function mkInstance(overrides: Partial<PublicInstance>): PublicInstance {
  return {
    ...baseInstance,
    id: 1,
    name: "Default",
    url: "http://localhost",
    type: "radarr",
    ...overrides,
  };
}

beforeEach(() => {
  mockPathname = "/movies";
  mockSearchParams = "";
  mockInstances = undefined;
  mockPush.mockClear();
});

afterEach(() => {
  mockInstances = undefined;
});

describe("MobileInstanceTab", () => {
  it("renders a plain Link when zero instances of the arr-type exist", () => {
    mockInstances = [];
    renderWithProviders(
      <MobileInstanceTab
        arrType="radarr"
        href="/movies"
        label="Movies"
        icon={Film}
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/movies");
    expect(link).toHaveTextContent("Movies");
    // No dropdown trigger
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders a Link with the single instance's id when 1 instance exists", () => {
    mockInstances = [mkInstance({ id: 7, name: "Solo", type: "radarr" })];
    renderWithProviders(
      <MobileInstanceTab
        arrType="radarr"
        href="/movies"
        label="Movies"
        icon={Film}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/movies?instanceId=7",
    );
  });

  it("renders a dropdown trigger with count badge when 2+ instances exist", () => {
    mockInstances = [
      mkInstance({ id: 1, name: "Primary", type: "radarr" }),
      mkInstance({ id: 2, name: "Backup", type: "radarr" }),
    ];
    renderWithProviders(
      <MobileInstanceTab
        arrType="radarr"
        href="/movies"
        label="Movies"
        icon={Film}
      />,
    );
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("2"); // badge
    expect(trigger).toHaveTextContent("Movies");
  });

  it("filters out instances of the other arr-type", () => {
    mockInstances = [
      mkInstance({ id: 1, name: "RadarrA", type: "radarr" }),
      mkInstance({ id: 2, name: "SonarrA", type: "sonarr" }),
      mkInstance({ id: 3, name: "SonarrB", type: "sonarr" }),
    ];
    renderWithProviders(
      <MobileInstanceTab
        arrType="radarr"
        href="/movies"
        label="Movies"
        icon={Film}
      />,
    );
    // Only 1 radarr — falls back to a plain Link with that instance.
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/movies?instanceId=1",
    );
  });

  it("filters out disabled instances", () => {
    mockInstances = [
      mkInstance({ id: 1, name: "Primary", type: "radarr", enabled: false }),
      mkInstance({ id: 2, name: "Secondary", type: "radarr" }),
    ];
    renderWithProviders(
      <MobileInstanceTab
        arrType="radarr"
        href="/movies"
        label="Movies"
        icon={Film}
      />,
    );
    // 1 enabled radarr only — plain Link.
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/movies?instanceId=2",
    );
  });

  it("preserves other query params when picking within the same route", () => {
    mockPathname = "/movies";
    mockSearchParams = "focus=42&foo=bar";
    mockInstances = [
      mkInstance({ id: 1, name: "A", type: "radarr" }),
      mkInstance({ id: 2, name: "B", type: "radarr" }),
    ];
    renderWithProviders(
      <MobileInstanceTab
        arrType="radarr"
        href="/movies"
        label="Movies"
        icon={Film}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("B"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    const target = mockPush.mock.calls[0][0] as string;
    expect(target).toContain("/movies?");
    expect(target).toContain("instanceId=2");
    expect(target).toContain("focus=42");
    expect(target).toContain("foo=bar");
  });

  it("drops query params when picking an instance on a different route", () => {
    // User is on /shows?mediaId=123 and taps the Movies tab to pick a
    // Radarr instance. The mediaId param is series-scoped and would
    // produce a misleading empty filter on /movies, so it must not
    // carry over.
    mockPathname = "/shows";
    mockSearchParams = "mediaId=123&focus=123";
    mockInstances = [
      mkInstance({ id: 1, name: "A", type: "radarr" }),
      mkInstance({ id: 2, name: "B", type: "radarr" }),
    ];
    renderWithProviders(
      <MobileInstanceTab
        arrType="radarr"
        href="/movies"
        label="Movies"
        icon={Film}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("B"));
    const target = mockPush.mock.calls[0][0] as string;
    expect(target).toBe("/movies?instanceId=2");
  });
});
