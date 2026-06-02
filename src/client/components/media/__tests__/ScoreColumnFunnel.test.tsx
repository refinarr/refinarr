// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import userEvent from "@testing-library/user-event";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { renderWithProviders, screen } from "@/test/render";
import { ScoreColumnFunnel } from "../ScoreColumnFunnel";

const baseFilters: MediaFilters = {
  sortBy: "score",
  order: "asc",
  minScore: null,
  maxScore: null,
  minSize: null,
  maxSize: null,
  q: "",
  mediaId: null,
  profileIds: [],
  severities: [],
  hasNegativeCfIds: [],
  hasNegativeCfMatch: "all",
  flaggedOnly: true,
  monitorStatus: "all",
};

describe("ScoreColumnFunnel", () => {
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

  it("renders the three profile-mode buckets", async () => {
    renderWithProviders(
      <ScoreColumnFunnel
        filters={baseFilters}
        onChange={() => {}}
        columnLabel="Score"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter score/i }),
    );
    for (const label of ["Negative", "Zero", "Positive"]) {
      expect(
        await screen.findByRole("button", { name: label }),
      ).toBeInTheDocument();
    }
  });

  it("clicking Negative sets minScore=null, maxScore=-1", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ScoreColumnFunnel
        filters={baseFilters}
        onChange={onChange}
        columnLabel="Score"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter score/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Negative" }),
    );
    expect(onChange).toHaveBeenCalledWith({ minScore: null, maxScore: -1 });
  });

  it("clicking the active bucket clears the filter", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ScoreColumnFunnel
        filters={{ ...baseFilters, minScore: null, maxScore: -1 }}
        onChange={onChange}
        columnLabel="Score"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter score/i }),
    );
    const activeChip = await screen.findByRole("button", { name: "Negative" });
    expect(activeChip).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(activeChip);
    expect(onChange).toHaveBeenCalledWith({ minScore: null, maxScore: null });
  });
});
