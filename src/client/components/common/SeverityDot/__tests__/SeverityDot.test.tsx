// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeverityDot } from "../SeverityDot";

describe("SeverityDot", () => {
  it("uses the correct status-token class for each severity", () => {
    const { rerender } = render(<SeverityDot severity="critical" />);
    expect(screen.getByRole("img")).toHaveClass("bg-critical");

    rerender(<SeverityDot severity="ok" />);
    expect(screen.getByRole("img")).toHaveClass("bg-ok");

    rerender(<SeverityDot severity="missing" />);
    expect(screen.getByRole("img")).toHaveClass("bg-neutral-soft");
  });

  it("exposes the severity label via aria-label and title for screen readers", () => {
    render(<SeverityDot severity="warning" />);
    expect(screen.getByRole("img", { name: "Warning" })).toBeInTheDocument();
    expect(screen.getByTitle("Warning")).toBeInTheDocument();
  });

  it("appends caller-provided className", () => {
    render(<SeverityDot severity="ok" className="extra-class" />);
    expect(screen.getByRole("img")).toHaveClass("extra-class");
  });
});
