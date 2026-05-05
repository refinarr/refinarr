// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/client/hooks/data/useInstances", () => ({
  useInstances: () => ({
    data: [{ id: 1, type: "radarr", name: "Radarr-Main" }],
  }),
}));

vi.mock("@/client/hooks/data/useConfig", () => ({
  useConfig: () => ({ data: { dryRun: true, scoringModes: {} } }),
}));

import { CommandPalette } from "../CommandPalette";

function fireKey(combo: { meta?: boolean; ctrl?: boolean; key: string }) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: combo.key,
      metaKey: combo.meta ?? false,
      ctrlKey: combo.ctrl ?? false,
      bubbles: true,
    }),
  );
}

describe("CommandPalette", () => {
  it("does not render the dialog before ⌘K is pressed", () => {
    renderWithProviders(<CommandPalette />);
    expect(
      screen.queryByPlaceholderText(/type a command/i),
    ).not.toBeInTheDocument();
  });

  it("opens on Cmd+K and shows the navigation commands", async () => {
    renderWithProviders(<CommandPalette />);
    fireKey({ meta: true, key: "k" });
    expect(
      await screen.findByPlaceholderText(/type a command/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Movies")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("opens on Ctrl+K too (Windows / Linux)", async () => {
    renderWithProviders(<CommandPalette />);
    fireKey({ ctrl: true, key: "k" });
    expect(
      await screen.findByPlaceholderText(/type a command/i),
    ).toBeInTheDocument();
  });

  it("shows the dry-run state badge", async () => {
    renderWithProviders(<CommandPalette />);
    fireKey({ meta: true, key: "k" });
    await screen.findByPlaceholderText(/type a command/i);
    // dryRun: true → status badge reads "On"
    const toggle = screen
      .getByText(/toggle dry run/i)
      .closest("[data-slot='command-item']")!;
    expect(toggle).toHaveTextContent(/on/i);
  });
});
