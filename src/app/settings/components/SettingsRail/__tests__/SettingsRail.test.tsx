// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Settings } from "lucide-react";
import { SettingsRail, type SettingsRailItem } from "../SettingsRail";

const ITEMS: SettingsRailItem[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "appearance", label: "Appearance", icon: Settings },
  { id: "instances", label: "Instances", icon: Settings },
];

describe("SettingsRail", () => {
  it("renders one button per item with the label", () => {
    render(<SettingsRail items={ITEMS} active="general" onSelect={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: /general/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /appearance/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /instances/i }),
    ).toBeInTheDocument();
  });

  it("marks the active item with aria-current=true", () => {
    render(
      <SettingsRail items={ITEMS} active="appearance" onSelect={() => {}} />,
    );
    const active = screen.getByRole("button", { name: /appearance/i });
    expect(active).toHaveAttribute("aria-current", "true");
    const inactive = screen.getByRole("button", { name: /general/i });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("calls onSelect with the clicked item id", () => {
    const onSelect = vi.fn();
    render(<SettingsRail items={ITEMS} active="general" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /instances/i }));
    expect(onSelect).toHaveBeenCalledWith("instances");
  });
});
