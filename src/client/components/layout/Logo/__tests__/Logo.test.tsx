// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "../Logo";

describe("Logo", () => {
  it("renders the wordmark with an accessible label by default", () => {
    render(<Logo />);
    const svg = screen.getByLabelText("Refinarr");
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute("viewBox")).toBe("0 0 800 193");
  });

  it("narrows the viewBox to the icon-only glyph when showWordmark is false", () => {
    render(<Logo showWordmark={false} />);
    const svg = screen.getByLabelText("Refinarr");
    expect(svg.getAttribute("viewBox")).toBe("0 0 163 193");
  });

  it("uses brand + foreground utility classes so theme switches retint without code changes", () => {
    const { container } = render(<Logo />);
    expect(container.querySelector(".fill-brand")).toBeTruthy();
    expect(container.querySelector(".fill-foreground")).toBeTruthy();
  });
});
