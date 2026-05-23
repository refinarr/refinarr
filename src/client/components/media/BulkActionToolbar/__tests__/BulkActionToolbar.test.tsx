// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { act } from "@testing-library/react";
import { renderWithProviders, screen } from "@/test/render";

import { BulkActionToolbar } from "../BulkActionToolbar";

// happy-dom doesn't always settle the requestAnimationFrame the v2 bar
// uses to flip `opening → open`. Drive it synchronously so assertions
// don't have to await frame ticks.
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback): number => {
    cb(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Reset the data-attribute the bar publishes so leakage between
  // tests doesn't confuse a future assertion that depends on it.
  delete document.documentElement.dataset.bulkBar;
});

describe("BulkActionToolbar (v2 floating)", () => {
  it("is NOT in the DOM when nothing is selected and no progress is running", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={0}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    // v2: no layout footprint while idle. None of the three actions
    // and no selection-count label should be reachable.
    expect(
      screen.queryByRole("button", { name: /^search$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^ignore$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^delete$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });

  it("appears with all three actions + clear + count when count > 0", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={3}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^search$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^ignore$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^delete$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^clear selection$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^more actions$/i }),
    ).toBeInTheDocument();
  });

  it("clicking the × clear button fires onClearSelection", async () => {
    const onClearSelection = vi.fn();
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={2}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onClearSelection={onClearSelection}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^clear selection$/i }),
    );
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("ESC dismisses the bar via onClearSelection while open", async () => {
    const onClearSelection = vi.fn();
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={1}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onClearSelection={onClearSelection}
      />,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("the three action buttons fire their respective callbacks", async () => {
    const onSearch = vi.fn();
    const onIgnore = vi.fn();
    const onDelete = vi.fn();
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={4}
        onSearch={onSearch}
        onIgnore={onIgnore}
        onDelete={onDelete}
        onClearSelection={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^ignore$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onIgnore).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("publishes data-bulk-bar='open' on <html> while open and clears it after unmount", () => {
    const { unmount } = renderWithProviders(
      <BulkActionToolbar
        selectedCount={1}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(document.documentElement.dataset.bulkBar).toBe("open");
    unmount();
    expect(document.documentElement.dataset.bulkBar).toBeUndefined();
  });

  it("renders an aria-live progress UI in place of action buttons when progress is provided", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={5}
        progress={{ current: 3, total: 5, action: "search" }}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/searching 3\/5/i);
    expect(
      screen.queryByRole("button", { name: /^search$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/5 selected/i)).not.toBeInTheDocument();
  });

  it("keeps the bar mounted with progress even when selectedCount drops to 0", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={0}
        progress={{ current: 5, total: 5, action: "delete" }}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/deleting 5\/5/i);
  });

  it("renders a Cancel button in progress mode and fires onCancel when clicked", async () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={5}
        progress={{ current: 2, total: 5, action: "search" }}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onClearSelection={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const cancelBtn = screen.getByRole("button", { name: /^cancel$/i });
    expect(cancelBtn).toBeInTheDocument();
    await userEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not render a Cancel button in progress mode when onCancel is not provided", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={5}
        progress={{ current: 2, total: 5, action: "search" }}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^cancel$/i }),
    ).not.toBeInTheDocument();
  });

  it("unmounts after the exit animation when the selection drops to 0", async () => {
    vi.useFakeTimers();
    const { rerender } = renderWithProviders(
      <BulkActionToolbar
        selectedCount={2}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /^search$/i }),
    ).toBeInTheDocument();

    rerender(
      <BulkActionToolbar
        selectedCount={0}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );

    // While `closing`, the bar is still mounted (still in DOM) so the
    // exit transition can play. After the 150ms timeout, it unmounts.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(
      screen.queryByRole("button", { name: /^search$/i }),
    ).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
