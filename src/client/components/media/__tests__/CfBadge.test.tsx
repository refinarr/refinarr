// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CfBadge } from "../CfBadge";

describe("CfBadge", () => {
  it("renders the format name", () => {
    render(<CfBadge name="HDR" />);
    expect(screen.getByText("HDR")).toBeInTheDocument();
  });

  it("uses destructive variant when missing", () => {
    render(<CfBadge name="HDR" missing />);
    const badge = screen.getByText("HDR");
    // shadcn destructive variant applies bg-destructive/text-destructive utilities.
    expect(badge.className).toMatch(/bg-destructive/);
  });

  it("uses secondary variant by default", () => {
    render(<CfBadge name="HDR" />);
    const badge = screen.getByText("HDR");
    expect(badge.className).toMatch(/bg-secondary/);
    expect(badge.className).not.toMatch(/bg-destructive/);
  });
});
