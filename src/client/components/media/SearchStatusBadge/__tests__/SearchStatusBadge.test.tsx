// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { SearchStatusBadge } from "../SearchStatusBadge";

describe("SearchStatusBadge", () => {
  it("renders pending badge linking to the queue scoped to instance", () => {
    renderWithProviders(<SearchStatusBadge status="pending" instanceId={3} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/queue?instanceId=3");
    expect(screen.getByText("Pending search")).toBeInTheDocument();
  });

  it("renders searched badge with relative time and link to history filtered by title", () => {
    renderWithProviders(
      <SearchStatusBadge
        status="searched"
        instanceId={7}
        title="Some Movie"
        relativeTime="12m ago"
      />,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "/history?instanceId=7&q=Some%20Movie",
    );
    expect(screen.getByText("Searched 12m ago")).toBeInTheDocument();
  });

  it("falls back to plain history link when no title is provided", () => {
    renderWithProviders(
      <SearchStatusBadge
        status="searched"
        instanceId={7}
        relativeTime="3m ago"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/history?instanceId=7",
    );
  });
});
