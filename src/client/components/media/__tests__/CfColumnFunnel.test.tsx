// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import userEvent from "@testing-library/user-event";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { renderWithProviders, screen } from "@/test/render";
import { CfColumnFunnel } from "../CfColumnFunnel";

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
  onlyMissing: false,
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

  it("renders a chip per option in manual mode", async () => {
    renderWithProviders(
      <CfColumnFunnel
        scoringMode="manual"
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

  it("toggles a chip into missingCfIds in manual mode", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CfColumnFunnel
        scoringMode="manual"
        options={options}
        filters={baseFilters}
        onChange={onChange}
        columnLabel="Custom Formats"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter custom formats/i }),
    );
    const hdrChip = await screen.findByRole("button", { name: /HDR/ });
    await userEvent.click(hdrChip);
    expect(onChange).toHaveBeenCalledWith({ missingCfIds: [1] });
  });

  it("toggles a chip into hasNegativeCfIds in profile mode", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CfColumnFunnel
        scoringMode="profile"
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
        scoringMode="manual"
        options={options}
        filters={{ ...baseFilters, missingCfIds: [1, 2] }}
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
    expect(onChange).toHaveBeenCalledWith({ missingCfIds: [2] });
  });

  it("Clear button resets the active filter slice", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CfColumnFunnel
        scoringMode="manual"
        options={options}
        filters={{
          ...baseFilters,
          missingCfIds: [1, 2],
          missingCfMatch: "any",
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
      missingCfIds: [],
      missingCfMatch: "all",
    });
  });

  it("shows an empty-state message when there are no options", async () => {
    renderWithProviders(
      <CfColumnFunnel
        scoringMode="manual"
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
