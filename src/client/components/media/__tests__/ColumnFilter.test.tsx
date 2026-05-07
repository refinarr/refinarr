// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/render";
import { ColumnFilter } from "../ColumnFilter";

describe("ColumnFilter", () => {
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

  it("renders the trigger with the provided aria-label", () => {
    renderWithProviders(
      <ColumnFilter
        active={false}
        title="Filter X"
        triggerAriaLabel="Filter X column"
      >
        body
      </ColumnFilter>,
    );
    expect(
      screen.getByRole("button", { name: /filter x column/i }),
    ).toBeInTheDocument();
  });

  it("opens the popover on click and renders title + body", async () => {
    renderWithProviders(
      <ColumnFilter
        active={false}
        title="Filter Status"
        description="Set conditions to filter this column"
        triggerAriaLabel="Filter Status column"
      >
        <div data-testid="body">body content</div>
      </ColumnFilter>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter status column/i }),
    );
    expect(await screen.findByText("Filter Status")).toBeInTheDocument();
    expect(
      screen.getByText("Set conditions to filter this column"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("body")).toBeInTheDocument();
  });

  it("renders Clear button only when active and onClear is provided", async () => {
    const onClear = vi.fn();
    renderWithProviders(
      <ColumnFilter
        active={true}
        title="Filter X"
        triggerAriaLabel="Filter X column"
        onClear={onClear}
        clearLabel="Clear filter"
      >
        body
      </ColumnFilter>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter x column/i }),
    );
    const clear = await screen.findByRole("button", { name: /clear filter/i });
    await userEvent.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("does not show Clear when not active even if onClear is provided", async () => {
    renderWithProviders(
      <ColumnFilter
        active={false}
        title="Filter X"
        triggerAriaLabel="Filter X column"
        onClear={() => {}}
        clearLabel="Clear filter"
      >
        body
      </ColumnFilter>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filter x column/i }),
    );
    await screen.findByText("Filter X");
    expect(
      screen.queryByRole("button", { name: /clear filter/i }),
    ).not.toBeInTheDocument();
  });
});
