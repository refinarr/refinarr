// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings } from "lucide-react";
import { SettingsPicker } from "../SettingsPicker";
import type { SettingsRailItem } from "../SettingsRail";

const ITEMS: SettingsRailItem[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "appearance", label: "Appearance", icon: Settings },
  { id: "instances", label: "Instances", icon: Settings },
];

describe("SettingsPicker", () => {
  // Save originals so we can restore them in afterAll. Without this
  // the shims leak into other tests in the same Vitest worker and can
  // hide DOM API regressions.
  const original = {
    hasPointerCapture: Element.prototype.hasPointerCapture,
    releasePointerCapture: Element.prototype.releasePointerCapture,
    scrollIntoView: Element.prototype.scrollIntoView,
  };

  beforeAll(() => {
    // Base UI / Radix-style Select uses pointer-capture APIs that
    // happy-dom doesn't fully implement.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });

  afterAll(() => {
    Element.prototype.hasPointerCapture = original.hasPointerCapture;
    Element.prototype.releasePointerCapture = original.releasePointerCapture;
    Element.prototype.scrollIntoView = original.scrollIntoView;
  });

  it("renders the active section label in the trigger", () => {
    render(
      <SettingsPicker items={ITEMS} active="appearance" onSelect={() => {}} />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent(/appearance/i);
  });

  it("calls onSelect with the chosen id when a different item is picked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <SettingsPicker items={ITEMS} active="general" onSelect={onSelect} />,
    );

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("[Enter]");

    const option = await screen.findByRole("option", { name: /instances/i });
    await user.click(option);

    expect(onSelect).toHaveBeenCalledWith("instances");
  });
});
