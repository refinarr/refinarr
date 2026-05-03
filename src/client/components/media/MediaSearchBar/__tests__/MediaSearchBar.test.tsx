// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/render";

vi.mock("@/client/hooks/data/useQualityProfiles", () => ({
  useQualityProfiles: () => ({ data: [] }),
}));

vi.mock("@/client/hooks/data/usePreferences", () => ({
  usePreferences: () => ({ data: [] }),
}));

import { MediaSearchBar } from "../MediaSearchBar";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";

const baseFilters: MediaFilters = {
  sortBy: "score",
  order: "asc",
  maxScore: 1,
  q: "",
  profileId: null,
  missingCfIds: [],
  missingCfMatch: "all",
  hasNegativeCfIds: [],
  hasNegativeCfMatch: "all",
};

describe("MediaSearchBar", () => {
  it("renders the inline filter controls (visible on md+) and a mobile Filters trigger", () => {
    renderWithProviders(
      <MediaSearchBar
        arrType="radarr"
        instanceId={1}
        scoringMode="manual"
        filters={baseFilters}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText(/search title/i)).toBeInTheDocument();
    const filtersBtn = screen.getByRole("button", { name: /^filters$/i });
    expect(filtersBtn.className).toContain("md:hidden");
  });

  it("opens the bottom filter sheet when the mobile Filters trigger is clicked", async () => {
    renderWithProviders(
      <MediaSearchBar
        arrType="radarr"
        instanceId={1}
        scoringMode="manual"
        filters={baseFilters}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /^apply$/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    expect(await screen.findByRole("button", { name: /^apply$/i })).toBeInTheDocument();
  });

  it("shows an active-filter count badge when filters are applied", () => {
    renderWithProviders(
      <MediaSearchBar
        arrType="radarr"
        instanceId={1}
        scoringMode="manual"
        filters={{ ...baseFilters, profileId: 1, maxScore: 0.5 }}
        onChange={vi.fn()}
      />
    );
    const trigger = screen.getByRole("button", { name: /^filters/i });
    expect(trigger).toHaveTextContent("2");
  });
});
