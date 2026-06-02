// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import userEvent from "@testing-library/user-event";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { renderWithProviders, screen } from "@/test/render";
import { CfColumnFunnel } from "../CfColumnFunnel";

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

const options = [
  { id: 1, name: "HDR" },
  { id: 2, name: "Atmos" },
  { id: 3, name: "DV" },
];

describe("CfColumnFunnel", () => {
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

  it("renders a chip per option", async () => {
    renderWithProviders(
      <CfColumnFunnel
        options={options}
        filters={baseFilters}
        onChange={() => {}}
        columnLabel="Custom Formats"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter custom formats/i }),
    );
    for (const opt of options) {
      expect(
        await screen.findByRole("button", { name: new RegExp(opt.name) }),
      ).toBeInTheDocument();
    }
  });

  it("toggles a chip into hasNegativeCfIds", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CfColumnFunnel
        options={options}
        filters={baseFilters}
        onChange={onChange}
        columnLabel="Custom Formats"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter custom formats/i }),
    );
    const dvChip = await screen.findByRole("button", { name: /DV/ });
    await userEvent.click(dvChip);
    expect(onChange).toHaveBeenCalledWith({ hasNegativeCfIds: [3] });
  });

  it("removes a chip when clicked again (toggle off)", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CfColumnFunnel
        options={options}
        filters={{ ...baseFilters, hasNegativeCfIds: [1, 2] }}
        onChange={onChange}
        columnLabel="Custom Formats"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter custom formats/i }),
    );
    const hdrChip = await screen.findByRole("button", { name: /HDR/ });
    expect(hdrChip).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(hdrChip);
    expect(onChange).toHaveBeenCalledWith({ hasNegativeCfIds: [2] });
  });

  it("Clear button resets the active filter slice", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CfColumnFunnel
        options={options}
        filters={{
          ...baseFilters,
          hasNegativeCfIds: [1, 2],
          hasNegativeCfMatch: "any",
        }}
        onChange={onChange}
        columnLabel="Custom Formats"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter custom formats/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /clear filter/i }),
    );
    expect(onChange).toHaveBeenCalledWith({
      hasNegativeCfIds: [],
      hasNegativeCfMatch: "all",
    });
  });

  it("shows an empty-state message when there are no options", async () => {
    renderWithProviders(
      <CfColumnFunnel
        options={[]}
        filters={baseFilters}
        onChange={() => {}}
        columnLabel="Custom Formats"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter custom formats/i }),
    );
    expect(
      await screen.findByText(/no custom formats available/i),
    ).toBeInTheDocument();
  });
});
