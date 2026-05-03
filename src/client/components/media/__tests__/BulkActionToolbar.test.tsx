// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
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
});
