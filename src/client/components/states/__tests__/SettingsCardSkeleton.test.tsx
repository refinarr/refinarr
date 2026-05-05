// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SettingsCardSkeleton } from "../SettingsCardSkeleton";

describe("SettingsCardSkeleton", () => {
  it("renders the default of 2 placeholder cards", () => {
    const { container } = render(<SettingsCardSkeleton />);
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-slot="card"]').length).toBe(2);
  });

  it("respects the rows prop", () => {
    const { container } = render(<SettingsCardSkeleton rows={4} />);
    expect(container.querySelectorAll('[data-slot="card"]').length).toBe(4);
  });
});
