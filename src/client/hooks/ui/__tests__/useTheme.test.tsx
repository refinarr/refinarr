// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import {
  THEME_BRAND_KEY,
  THEME_MODE_KEY,
  setBrand as setBrandRuntime,
  setMode as setModeRuntime,
} from "@/client/lib/theme";
import { useTheme } from "../useTheme";

function Probe() {
  const { brand, brands, mode, surface, setBrand, setMode } = useTheme();
  return (
    <div>
      <span data-testid="brand">{brand.id}</span>
      <span data-testid="mode">{mode}</span>
      <span data-testid="surface">{surface}</span>
      <span data-testid="count">{brands.length}</span>
      <button onClick={() => setBrand("teal")}>switch-brand</button>
      <button onClick={() => setMode("light")}>switch-mode</button>
    </div>
  );
}

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");
    document.documentElement.classList.remove("dark", "theme-transition");
  });

  it("returns the current brand, mode, surface and the registry", () => {
    localStorage.setItem(THEME_BRAND_KEY, "amber");
    localStorage.setItem(THEME_MODE_KEY, "light");
    render(<Probe />);
    expect(screen.getByTestId("brand").textContent).toBe("amber");
    expect(screen.getByTestId("mode").textContent).toBe("light");
    expect(screen.getByTestId("surface").textContent).toBe("light");
    expect(screen.getByTestId("count").textContent).toBe("2");
  });

  it("re-renders when setBrand fires", async () => {
    localStorage.setItem(THEME_MODE_KEY, "light");
    render(<Probe />);
    expect(screen.getByTestId("brand").textContent).toBe("amber");
    await act(async () => {
      screen.getByText("switch-brand").click();
    });
    expect(screen.getByTestId("brand").textContent).toBe("teal");
    expect(screen.getByTestId("mode").textContent).toBe("light");
  });

  it("re-renders when setMode fires", async () => {
    localStorage.setItem(THEME_BRAND_KEY, "teal");
    localStorage.setItem(THEME_MODE_KEY, "dark");
    render(<Probe />);
    await act(async () => {
      screen.getByText("switch-mode").click();
    });
    expect(screen.getByTestId("brand").textContent).toBe("teal");
    expect(screen.getByTestId("mode").textContent).toBe("light");
    expect(screen.getByTestId("surface").textContent).toBe("light");
  });

  it("subscribes to external setBrand and setMode calls", async () => {
    render(<Probe />);
    await act(async () => {
      setModeRuntime("light");
    });
    expect(screen.getByTestId("mode").textContent).toBe("light");
    await act(async () => {
      setBrandRuntime("teal");
    });
    expect(screen.getByTestId("brand").textContent).toBe("teal");
  });
});
