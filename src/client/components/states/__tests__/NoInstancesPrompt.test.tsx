// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/render";
import { NoInstancesPrompt } from "../NoInstancesPrompt";

describe("NoInstancesPrompt", () => {
  it("renders the title, body, and CTA from translations", () => {
    renderWithProviders(<NoInstancesPrompt onAdd={() => {}} />);
    // Strings come from messages/en.json under states.noInstances.
    expect(screen.getByText("No instances configured")).toBeInTheDocument();
    expect(
      screen.getByText(/add a radarr or sonarr instance/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add instance/i }),
    ).toBeInTheDocument();
  });

  it("calls onAdd when the CTA is clicked", async () => {
    const onAdd = vi.fn();
    renderWithProviders(<NoInstancesPrompt onAdd={onAdd} />);
    await userEvent.click(
      screen.getByRole("button", { name: /add instance/i }),
    );
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
