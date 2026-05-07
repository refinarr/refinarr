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
};

describe("MediaSearchBar", () => {
  it("renders the search input and the Only missing toggle pill", () => {
    renderWithProviders(
      <MediaSearchBar filters={baseFilters} onChange={vi.fn()} />,
    );
    expect(screen.getByPlaceholderText(/search title/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /only missing/i }),
    ).toBeInTheDocument();
  });

  it("invokes onChange when the Only missing pill is toggled", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MediaSearchBar filters={baseFilters} onChange={onChange} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /only missing/i }),
    );
    expect(onChange).toHaveBeenCalledWith({ onlyMissing: true });
  });

  it("shows Clear all only when at least one filter is active", async () => {
    const { rerender } = renderWithProviders(
      <MediaSearchBar filters={baseFilters} onChange={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: /clear all/i }),
    ).not.toBeInTheDocument();

    rerender(
      <MediaSearchBar
        filters={{ ...baseFilters, onlyMissing: true }}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /clear all/i }),
    ).toBeInTheDocument();
  });

  it("Clear all resets every value-bearing filter", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MediaSearchBar
        filters={{
          ...baseFilters,
          profileIds: [1],
          minScore: 0,
          maxScore: 0.5,
          onlyMissing: true,
          q: "x",
        }}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(onChange).toHaveBeenCalledWith({
      q: "",
      profileIds: [],
      severities: [],
      minScore: null,
      maxScore: null,
      minSize: null,
      maxSize: null,
      missingCfIds: [],
      missingCfMatch: "all",
      hasNegativeCfIds: [],
      hasNegativeCfMatch: "all",
      onlyMissing: false,
      flaggedOnly: true,
    });
  });
});
