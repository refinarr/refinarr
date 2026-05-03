// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/client/hooks/data/useMe", () => ({
  useMe: () => ({ data: { username: "admin", source: "session" } }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/client/hooks/data/useHealth", () => ({
  useHealth: () => ({ data: { status: "ok" }, isError: false }),
}));

import { Topbar } from "../Topbar";

describe("Topbar", () => {
  it("renders the hamburger trigger with an accessible label", () => {
    renderWithProviders(<Topbar />);
    expect(screen.getByRole("button", { name: /open navigation menu/i })).toBeInTheDocument();
  });

  it("opens the navigation sheet on hamburger click", async () => {
    renderWithProviders(<Topbar />);
    expect(screen.queryByRole("link", { name: /movies/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));
    expect(await screen.findByRole("link", { name: /movies/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /shows/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });
});
