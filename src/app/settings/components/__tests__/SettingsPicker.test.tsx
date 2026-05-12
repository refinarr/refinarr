// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings } from "lucide-react";

// Stub Next.js navigation hooks: usePathname feeds the active item,
// router.push() is the navigation effect we assert on.
let mockPathname = "/settings/general";
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: pushMock }),
}));

import { SettingsPicker } from "../SettingsPicker";
import type { SettingsRailItem } from "../SettingsRail";

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

  it("renders the label of the section matching the current pathname", () => {
    mockPathname = "/settings/appearance";
    render(<SettingsPicker items={ITEMS} />);
    expect(screen.getByRole("combobox")).toHaveTextContent(/appearance/i);
  });

  it("calls router.push with the chosen item's href", async () => {
    mockPathname = "/settings/general";
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<SettingsPicker items={ITEMS} />);

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("[Enter]");

    const option = await screen.findByRole("option", { name: /instances/i });
    await user.click(option);

    expect(pushMock).toHaveBeenCalledWith("/settings/instances");
  });
});
