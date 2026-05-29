// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import userEvent from "@testing-library/user-event";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { renderWithProviders, screen } from "@/test/render";
import { SeverityColumnFunnel } from "../SeverityColumnFunnel";

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
  missingCfIds: [],
  missingCfMatch: "all",
  hasNegativeCfIds: [],
  hasNegativeCfMatch: "all",
  flaggedOnly: true,
  monitorStatus: "all",
};

describe("SeverityColumnFunnel", () => {
  // Base UI / Radix-style Popover uses pointer-capture APIs that
  // happy-dom doesn't fully implement.
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

  it("renders a chip for every severity bucket", async () => {
    renderWithProviders(
      <SeverityColumnFunnel
        filters={baseFilters}
        onChange={() => {}}
        columnLabel="Severity"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter severity/i }),
    );
    for (const label of ["Critical", "Low", "Warning", "OK", "No file"]) {
      expect(
        await screen.findByRole("button", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
  });

  it("toggles a chip into severities", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <SeverityColumnFunnel
        filters={baseFilters}
        onChange={onChange}
        columnLabel="Severity"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter severity/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /critical/i }),
    );
    expect(onChange).toHaveBeenCalledWith({ severities: ["critical"] });
  });

  it("Clear resets the severities filter slice", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <SeverityColumnFunnel
        filters={{ ...baseFilters, severities: ["critical", "low"] }}
        onChange={onChange}
        columnLabel="Severity"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter severity/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /clear filter/i }),
    );
    expect(onChange).toHaveBeenCalledWith({ severities: [] });
  });
});
