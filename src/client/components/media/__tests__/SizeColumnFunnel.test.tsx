// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import userEvent from "@testing-library/user-event";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { renderWithProviders, screen } from "@/test/render";
import { SizeColumnFunnel } from "../SizeColumnFunnel";

const GB = 1024 ** 3;

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
};

describe("SizeColumnFunnel", () => {
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

  it("renders all six bucket chips", async () => {
    renderWithProviders(
      <SizeColumnFunnel
        filters={baseFilters}
        onChange={() => {}}
        columnLabel="Size"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /filter size/i }));
    for (const label of [
      "< 1 GB",
      "1 – 5 GB",
      "5 – 10 GB",
      "10 – 25 GB",
      "25 – 50 GB",
      "> 50 GB",
    ]) {
      expect(
        await screen.findByRole("button", { name: label }),
      ).toBeInTheDocument();
    }
  });

  it("clicking a bucket sets minSize / maxSize to its bounds", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <SizeColumnFunnel
        filters={baseFilters}
        onChange={onChange}
        columnLabel="Size"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /filter size/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: "1 – 5 GB" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      minSize: 1 * GB,
      maxSize: 5 * GB - 1,
    });
  });

  it("clicking the active bucket clears the filter", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <SizeColumnFunnel
        filters={{ ...baseFilters, minSize: 50 * GB, maxSize: null }}
        onChange={onChange}
        columnLabel="Size"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /filter size/i }));
    const activeChip = await screen.findByRole("button", { name: "> 50 GB" });
    expect(activeChip).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(activeChip);
    expect(onChange).toHaveBeenCalledWith({ minSize: null, maxSize: null });
  });

  it("Clear resets the size filter slice", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <SizeColumnFunnel
        filters={{ ...baseFilters, minSize: 1 * GB, maxSize: 5 * GB - 1 }}
        onChange={onChange}
        columnLabel="Size"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /filter size/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: /clear filter/i }),
    );
    expect(onChange).toHaveBeenCalledWith({ minSize: null, maxSize: null });
  });
});
