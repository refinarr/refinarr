// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import type { MovieItem, QualityProfile } from "@/shared/types/models";
import { renderWithProviders, screen } from "@/test/render";
import { MovieDetailDrawer } from "../MovieDetailDrawer";

const movie: MovieItem = {
  id: 1,
  title: "Fearless",
  year: 2020,
  qualityProfileId: 100,
  movieFileId: 5,
  customFormats: [],
  customFormatScore: 0,
  hasFile: true,
  cfScore: 0.5,
  missingFormats: [],
  unwantedFormats: [],
  sizeOnDisk: 1024 * 1024 * 1024,
  monitored: true,
  existingFileCount: 1,
  totalFileCount: 1,
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
  {
    id: 200,
    name: "Ultra-HD",
    minUpgradeFormatScore: 0,
    cutoffFormatScore: 100,
    formatItems: [],
  },
];

describe("MovieDetailDrawer", () => {
  it("renders the profile name resolved from qualityProfileId", () => {
    renderWithProviders(
      <MovieDetailDrawer
        movie={movie}
        open
        onOpenChange={vi.fn()}
        profiles={profiles}
        onSearch={vi.fn()}
        onIgnore={vi.fn()}
      />,
    );
    expect(screen.getByText("HD-1080p")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("falls back to em-dash when the profile is missing from the list", () => {
    renderWithProviders(
      <MovieDetailDrawer
        movie={{ ...movie, qualityProfileId: 999 }}
        open
        onOpenChange={vi.fn()}
        profiles={profiles}
        onSearch={vi.fn()}
        onIgnore={vi.fn()}
      />,
    );
    // The Profile cell renders "—" when no match.
    const profileLabel = screen.getByText("Profile");
    expect(profileLabel.nextElementSibling?.textContent).toBe("—");
  });

  it("falls back to em-dash when profiles is undefined (still loading)", () => {
    renderWithProviders(
      <MovieDetailDrawer
        movie={movie}
        open
        onOpenChange={vi.fn()}
        profiles={undefined}
        onSearch={vi.fn()}
        onIgnore={vi.fn()}
      />,
    );
    const profileLabel = screen.getByText("Profile");
    expect(profileLabel.nextElementSibling?.textContent).toBe("—");
  });
});
