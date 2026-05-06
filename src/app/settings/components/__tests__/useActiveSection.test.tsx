// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useActiveSection } from "../useActiveSection";

interface ObserverCallback {
  (
    entries: Array<{
      isIntersecting: boolean;
      target: Element;
      boundingClientRect: { top: number };
    }>,
  ): void;
}

let lastCallback: ObserverCallback | null = null;
let observed: Element[] = [];
let disconnected = false;

class StubObserver {
  callback: ObserverCallback;
  constructor(cb: ObserverCallback) {
    this.callback = cb;
    lastCallback = cb;
  }
  observe(target: Element) {
    observed.push(target);
  }
  disconnect() {
    disconnected = true;
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
}

vi.stubGlobal("IntersectionObserver", StubObserver);

function Probe({ ids }: { ids: string[] }) {
  const active = useActiveSection({ ids });
  return <span data-testid="active">{active}</span>;
}

function setupSections(ids: string[]) {
  for (const id of ids) {
    const el = document.createElement("section");
    el.id = id;
    document.body.appendChild(el);
  }
}

describe("useActiveSection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    lastCallback = null;
    observed = [];
    disconnected = false;
  });

  it("seeds the first id as active before any intersection fires", () => {
    setupSections(["a", "b", "c"]);
    const { getByTestId } = render(<Probe ids={["a", "b", "c"]} />);
    expect(getByTestId("active").textContent).toBe("a");
  });

  it("observes every existing section element", () => {
    setupSections(["a", "b", "c"]);
    render(<Probe ids={["a", "b", "c"]} />);
    expect(observed).toHaveLength(3);
    expect(observed.map((el) => (el as HTMLElement).id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("returns the topmost intersecting id when multiple are visible", () => {
    setupSections(["a", "b", "c"]);
    const { getByTestId } = render(<Probe ids={["a", "b", "c"]} />);

    act(() => {
      lastCallback!([
        {
          isIntersecting: true,
          target: document.getElementById("c")!,
          boundingClientRect: { top: 400 },
        },
        {
          isIntersecting: true,
          target: document.getElementById("b")!,
          boundingClientRect: { top: 100 },
        },
      ]);
    });

    expect(getByTestId("active").textContent).toBe("b");
  });

  it("ignores non-intersecting entries", () => {
    setupSections(["a", "b"]);
    const { getByTestId } = render(<Probe ids={["a", "b"]} />);

    act(() => {
      lastCallback!([
        {
          isIntersecting: false,
          target: document.getElementById("b")!,
          boundingClientRect: { top: 50 },
        },
      ]);
    });

    expect(getByTestId("active").textContent).toBe("a");
  });

  it("disconnects the observer on unmount", () => {
    setupSections(["a"]);
    const { unmount } = render(<Probe ids={["a"]} />);
    unmount();
    expect(disconnected).toBe(true);
  });
});
