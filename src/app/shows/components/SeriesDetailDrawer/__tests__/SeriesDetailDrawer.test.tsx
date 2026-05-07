// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import type { FlaggedSeries, QualityProfile } from "@/shared/types/models";
import { renderWithProviders, screen } from "@/test/render";
import { SeriesDetailDrawer } from "../SeriesDetailDrawer";

const series: FlaggedSeries = {
  id: 1,
  title: "The Silencing",
  year: 2020,
  qualityProfileId: 100,
  customFormats: [],
  customFormatScore: 0,
  cfScore: 0.5,
  missingFormats: [],
  unwantedFormats: [],
  affectedEpisodeCount: 3,
  totalEpisodeCount: 10,
  episodeFiles: [],
  sizeOnDisk: 1024 * 1024 * 1024,
  monitored: true,
  existingFileCount: 7,
  totalFileCount: 10,
  flagged: true,
};

const profiles: QualityProfile[] = [
  {
    id: 100,
    name: "HD-1080p",
    minUpgradeFormatScore: 0,
    cutoffFormatScore: 100,
    formatItems: [],
  },
];

const noopHandlers = {
  onIgnore: vi.fn(),
  onSearchSeason: vi.fn().mockResolvedValue(undefined),
  onSearchEpisode: vi.fn().mockResolvedValue(undefined),
  onDeleteSeason: vi.fn().mockResolvedValue(undefined),
  onDeleteEpisode: vi.fn().mockResolvedValue(undefined),
};

describe("SeriesDetailDrawer", () => {
  it("renders the profile name resolved from qualityProfileId", () => {
    renderWithProviders(
      <SeriesDetailDrawer
        series={series}
        open
        onOpenChange={vi.fn()}
        scoringMode="profile"
        profiles={profiles}
        {...noopHandlers}
      />,
    );
    expect(screen.getByText("HD-1080p")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("falls back to em-dash when the profile is missing from the list", () => {
    renderWithProviders(
      <SeriesDetailDrawer
        series={{ ...series, qualityProfileId: 999 }}
        open
        onOpenChange={vi.fn()}
        scoringMode="profile"
        profiles={profiles}
        {...noopHandlers}
      />,
    );
    const profileLabel = screen.getByText("Profile");
    expect(profileLabel.nextElementSibling?.textContent).toBe("—");
  });
});
