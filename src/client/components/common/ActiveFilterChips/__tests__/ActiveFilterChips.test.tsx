// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/render";
import { ActiveFilterChips, type FilterChip } from "../ActiveFilterChips";

function makeChip(key: string, label: string): FilterChip {
  return { key, label, onRemove: vi.fn() };
}

describe("ActiveFilterChips", () => {
  it("renders nothing when the chips list is empty", () => {
    const { container } = renderWithProviders(<ActiveFilterChips chips={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one badge per chip with the chip label", () => {
    const chips = [
      makeChip("q", "Search: matrix"),
      makeChip("profile-1", "Profile: HD-1080p"),
    ];
    renderWithProviders(<ActiveFilterChips chips={chips} />);
    expect(screen.getByText(/search: matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/profile: hd-1080p/i)).toBeInTheDocument();
  });

  it("invokes the chip's onRemove when its X button is clicked", async () => {
    const chip = makeChip("q", "Search: matrix");
    renderWithProviders(<ActiveFilterChips chips={[chip]} />);
    await userEvent.click(
      screen.getByRole("button", { name: /search: matrix/i }),
    );
    expect(chip.onRemove).toHaveBeenCalledTimes(1);
  });

  it("does NOT render Clear all when onClearAll is omitted", () => {
    renderWithProviders(
      <ActiveFilterChips chips={[makeChip("q", "Search: matrix")]} />,
    );
    expect(
      screen.queryByRole("button", { name: /clear all/i }),
    ).not.toBeInTheDocument();
  });

  it("renders Clear all when onClearAll is provided AND chips are present", () => {
    renderWithProviders(
      <ActiveFilterChips
        chips={[makeChip("q", "Search: matrix")]}
        onClearAll={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /clear all/i }),
    ).toBeInTheDocument();
  });

  it("hides Clear all (and the whole strip) when chips are empty even if onClearAll is provided", () => {
    renderWithProviders(<ActiveFilterChips chips={[]} onClearAll={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /clear all/i }),
    ).not.toBeInTheDocument();
  });

  it("invokes onClearAll when Clear all is clicked", async () => {
    const onClearAll = vi.fn();
    renderWithProviders(
      <ActiveFilterChips
        chips={[makeChip("q", "Search: matrix")]}
        onClearAll={onClearAll}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("renders the 'Active:' label only when chips exist", () => {
    const { rerender } = renderWithProviders(<ActiveFilterChips chips={[]} />);
    expect(screen.queryByText(/active/i)).not.toBeInTheDocument();
    rerender(<ActiveFilterChips chips={[makeChip("q", "Search: matrix")]} />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });
});
