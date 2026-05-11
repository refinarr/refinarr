// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { renderWithProviders, screen } from "@/test/render";
import { MediaSearchBar } from "../MediaSearchBar";

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
  onlyMissing: false,
  flaggedOnly: true,
  monitorStatus: "all",
};

describe("MediaSearchBar", () => {
  it("renders the search input", () => {
    renderWithProviders(
      <MediaSearchBar filters={baseFilters} onChange={vi.fn()} />,
    );
    expect(screen.getByPlaceholderText(/search title/i)).toBeInTheDocument();
  });

  it("does not render the Only missing pill (lives in QuickToggles / MobileFilterBar)", () => {
    renderWithProviders(
      <MediaSearchBar filters={baseFilters} onChange={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: /only missing/i }),
    ).not.toBeInTheDocument();
  });

  it("does not render a Clear all button (lives in ActiveFilterChips)", () => {
    renderWithProviders(
      <MediaSearchBar
        filters={{ ...baseFilters, onlyMissing: true, q: "x" }}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /clear all/i }),
    ).not.toBeInTheDocument();
  });

  it("does not render a Show all pill (driven by Instance.showAllMedia)", () => {
    renderWithProviders(
      <MediaSearchBar
        filters={{ ...baseFilters, flaggedOnly: false }}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /show all/i }),
    ).not.toBeInTheDocument();
  });

  it("invokes onChange when the search input changes", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MediaSearchBar filters={baseFilters} onChange={onChange} />,
    );
    await userEvent.type(screen.getByPlaceholderText(/search title/i), "x");
    expect(onChange).toHaveBeenCalledWith({ q: "x" });
  });
});
