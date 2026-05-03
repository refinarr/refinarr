// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { KeyboardHelpDialog } from "../KeyboardHelpDialog";

function fireQuestion(target?: HTMLElement) {
  const event = new KeyboardEvent("keydown", { key: "?", bubbles: true });
  if (target) {
    target.dispatchEvent(event);
  } else {
    document.dispatchEvent(event);
  }
}

describe("KeyboardHelpDialog", () => {
  it("does not render the dialog before ? is pressed", () => {
    renderWithProviders(<KeyboardHelpDialog />);
    expect(screen.queryByRole("heading", { name: /keyboard shortcuts/i })).not.toBeInTheDocument();
  });

  it("opens when ? is pressed outside an input", async () => {
    renderWithProviders(<KeyboardHelpDialog />);
    fireQuestion();
    expect(
      await screen.findByRole("heading", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Open command palette \(macOS\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Open command palette \(Windows/i)).toBeInTheDocument();
  });

  it("ignores ? when the keydown originates from an input", () => {
    const { container } = renderWithProviders(
      <>
        <input data-testid="probe" />
        <KeyboardHelpDialog />
      </>,
    );
    const probe = container.querySelector('[data-testid="probe"]') as HTMLInputElement;
    probe.focus();
    fireQuestion(probe);
    expect(screen.queryByRole("heading", { name: /keyboard shortcuts/i })).not.toBeInTheDocument();
  });
});
