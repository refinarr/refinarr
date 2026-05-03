// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/render";
import { BulkActionToolbar } from "../BulkActionToolbar";

describe("BulkActionToolbar", () => {
  it("renders nothing when nothing is selected", () => {
    const { container } = renderWithProviders(
      <BulkActionToolbar selectedCount={0} onSearch={vi.fn()} onDelete={vi.fn()} onIgnore={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all four actions when count > 0", () => {
    renderWithProviders(
      <BulkActionToolbar selectedCount={3} onSearch={vi.fn()} onDelete={vi.fn()} onIgnore={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /^search$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ignore$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete and search/i })).toBeInTheDocument();
  });

  it("uses fixed-bottom positioning on mobile and static layout above md", () => {
    renderWithProviders(
      <BulkActionToolbar selectedCount={1} onSearch={vi.fn()} onDelete={vi.fn()} onIgnore={vi.fn()} />
    );
    const toolbar = screen.getByText(/1 selected/i).parentElement!;
    expect(toolbar.className).toContain("fixed");
    expect(toolbar.className).toContain("bottom-0");
    expect(toolbar.className).toContain("md:static");
  });

  it("renders an aria-live progress UI in place of action buttons when progress is provided", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={5}
        progress={{ current: 3, total: 5, action: "search" }}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
      />
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/searching 3\/5/i);
    expect(screen.queryByRole("button", { name: /^search$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/5 selected/i)).not.toBeInTheDocument();
  });

  it("still renders the toolbar with progress when nothing is selected (final tick after clearing)", () => {
    renderWithProviders(
      <BulkActionToolbar
        selectedCount={0}
        progress={{ current: 5, total: 5, action: "delete" }}
        onSearch={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
      />
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
        onCancel={onCancel}
      />
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
      />
    );
    expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();
  });
});
