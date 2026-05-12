// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import userEvent from "@testing-library/user-event";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import type { QualityProfile } from "@/shared/types/models";
import { renderWithProviders, screen } from "@/test/render";
import { ProfileColumnFunnel } from "../ProfileColumnFunnel";

const baseFilters: MediaFilters = {
  sortBy: "score",
  order: "asc",
  minScore: null,
  maxScore: null,
  minSize: null,
  maxSize: null,
  q: "",
  profileIds: [],
  severities: [],
  missingCfIds: [],
  missingCfMatch: "all",
  hasNegativeCfIds: [],
  hasNegativeCfMatch: "all",
  flaggedOnly: true,
  monitorStatus: "all",
};

const profiles: QualityProfile[] = [
  {
    id: 1,
    name: "HD-1080p",
    minUpgradeFormatScore: 0,
    cutoffFormatScore: 100,
    formatItems: [],
  },
  {
    id: 2,
    name: "UHD-2160p",
    minUpgradeFormatScore: 0,
    cutoffFormatScore: 200,
    formatItems: [],
  },
];

describe("ProfileColumnFunnel", () => {
  const original = {
    hasPointerCapture: Element.prototype.hasPointerCapture,
    releasePointerCapture: Element.prototype.releasePointerCapture,
    scrollIntoView: Element.prototype.scrollIntoView,
  };
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });
  afterAll(() => {
    Element.prototype.hasPointerCapture = original.hasPointerCapture;
    Element.prototype.releasePointerCapture = original.releasePointerCapture;
    Element.prototype.scrollIntoView = original.scrollIntoView;
  });

  it("renders one chip per profile", async () => {
    renderWithProviders(
      <ProfileColumnFunnel
        profiles={profiles}
        filters={baseFilters}
        onChange={() => {}}
        columnLabel="Profile"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter profile/i }),
    );
    expect(
      await screen.findByRole("button", { name: /HD-1080p/ }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /UHD-2160p/ }),
    ).toBeInTheDocument();
  });

  it("toggles a profile into profileIds", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ProfileColumnFunnel
        profiles={profiles}
        filters={baseFilters}
        onChange={onChange}
        columnLabel="Profile"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter profile/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /UHD-2160p/ }),
    );
    expect(onChange).toHaveBeenCalledWith({ profileIds: [2] });
  });

  it("removes a profile when toggled off", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ProfileColumnFunnel
        profiles={profiles}
        filters={{ ...baseFilters, profileIds: [1, 2] }}
        onChange={onChange}
        columnLabel="Profile"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter profile/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /HD-1080p/ }),
    );
    expect(onChange).toHaveBeenCalledWith({ profileIds: [2] });
  });

  it("shows an empty state when there are no profiles", async () => {
    renderWithProviders(
      <ProfileColumnFunnel
        profiles={[]}
        filters={baseFilters}
        onChange={() => {}}
        columnLabel="Profile"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter profile/i }),
    );
    expect(
      await screen.findByText(/no quality profiles available/i),
    ).toBeInTheDocument();
  });
});
