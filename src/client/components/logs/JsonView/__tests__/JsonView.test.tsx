// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JsonView } from "../JsonView";

describe("JsonView", () => {
  it("renders primitive values with their semantic Tailwind class", () => {
    render(
      <JsonView
        value={{ message: "hello", count: 42, active: true, missing: null }}
      />,
    );
    expect(screen.getByText('"hello"').className).toMatch(/text-emerald-400/);
    expect(screen.getByText("42").className).toMatch(/text-amber-400/);
    expect(screen.getByText("true").className).toMatch(/text-violet-400/);
    expect(screen.getByText("null").className).toMatch(/italic/);
  });

  it("renders keys with the sky-400 class", () => {
    render(<JsonView value={{ instanceId: 1 }} />);
    expect(screen.getByText('"instanceId"').className).toMatch(/text-sky-400/);
  });

  it("collapses an object node when its chevron is clicked", () => {
    render(
      <JsonView
        value={{ nested: { hidden: "value" } }}
        initiallyExpandedDepth={5}
      />,
    );
    // Nested value visible while open.
    expect(screen.getByText('"value"')).toBeTruthy();

    // The toggle that owns the nested object — first child object's
    // chevron. Click it and the nested primitive disappears.
    const toggles = screen.getAllByLabelText("Collapse");
    // The first one toggles the root, the second the nested object.
    fireEvent.click(toggles[1]);
    expect(screen.queryByText('"value"')).toBeNull();
  });

  it("starts deeply nested nodes collapsed when beyond initiallyExpandedDepth", () => {
    render(
      <JsonView
        value={{ a: { b: { c: "deep" } } }}
        initiallyExpandedDepth={1}
      />,
    );
    expect(screen.queryByText('"deep"')).toBeNull();
  });
});
