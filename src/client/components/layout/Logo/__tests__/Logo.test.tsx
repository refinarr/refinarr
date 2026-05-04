// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "../Logo";

describe("Logo", () => {
  it("renders the wordmark by default with the *arr suffix split out", () => {
    render(<Logo />);
    expect(screen.getByText("Refin")).toBeInTheDocument();
    expect(screen.getByText("arr")).toBeInTheDocument();
  });

  it("hides the wordmark when showWordmark is false", () => {
    render(<Logo showWordmark={false} />);
    expect(screen.queryByText("Refin")).not.toBeInTheDocument();
  });

  it("uses the brand utility classes so theme switches retint without code changes", () => {
    const { container } = render(<Logo />);
    expect(container.querySelector(".fill-brand")).toBeTruthy();
    expect(container.querySelector(".fill-foreground-on-brand")).toBeTruthy();
    expect(container.querySelector(".text-brand")).toBeTruthy();
  });
});
