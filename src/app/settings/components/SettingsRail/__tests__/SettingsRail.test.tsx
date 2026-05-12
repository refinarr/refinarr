// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { renderWithProviders } from "@/test/render";

// Stub Next.js navigation hooks so we can drive the rail's
// pathname-derived "active" state without a real router.
let mockPathname = "/settings/general";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { SettingsRail, type SettingsRailItem } from "../SettingsRail";

const ITEMS: SettingsRailItem[] = [
  {
    id: "general",
    label: "General",
    icon: Settings,
    href: "/settings/general",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Settings,
    href: "/settings/appearance",
  },
  {
    id: "instances",
    label: "Instances",
    icon: Settings,
    href: "/settings/instances",
  },
];

describe("SettingsRail", () => {
  it("renders one Link per item with the label", () => {
    mockPathname = "/settings/general";
    renderWithProviders(<SettingsRail items={ITEMS} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(screen.getByRole("link", { name: /general/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /appearance/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /instances/i }),
    ).toBeInTheDocument();
  });

  it("marks the link matching the current pathname with aria-current=page", () => {
    mockPathname = "/settings/appearance";
    renderWithProviders(<SettingsRail items={ITEMS} />);
    const active = screen.getByRole("link", { name: /appearance/i });
    expect(active).toHaveAttribute("aria-current", "page");
    const inactive = screen.getByRole("link", { name: /general/i });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("treats nested paths as matching the parent entry", () => {
    // e.g. /settings/instances/123 should still highlight 'Instances'.
    mockPathname = "/settings/instances/42";
    renderWithProviders(<SettingsRail items={ITEMS} />);
    expect(screen.getByRole("link", { name: /instances/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders Links pointing at each item's href", () => {
    mockPathname = "/settings/general";
    renderWithProviders(<SettingsRail items={ITEMS} />);
    expect(screen.getByRole("link", { name: /general/i })).toHaveAttribute(
      "href",
      "/settings/general",
    );
    expect(screen.getByRole("link", { name: /appearance/i })).toHaveAttribute(
      "href",
      "/settings/appearance",
    );
  });
});
