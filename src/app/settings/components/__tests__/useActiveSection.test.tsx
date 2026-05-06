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

function Probe({
  ids,
  onChange,
}: {
  ids: string[];
  onChange: (id: string) => void;
}) {
  useActiveSection({ ids, onChange });
  return null;
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

  it("observes every existing section element", () => {
    setupSections(["a", "b", "c"]);
    render(<Probe ids={["a", "b", "c"]} onChange={() => {}} />);
    expect(observed).toHaveLength(3);
    expect(observed.map((el) => (el as HTMLElement).id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("calls onChange with the topmost intersecting id when multiple are visible", () => {
    setupSections(["a", "b", "c"]);
    const onChange = vi.fn();
    render(<Probe ids={["a", "b", "c"]} onChange={onChange} />);

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

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("ignores non-intersecting entries", () => {
    setupSections(["a", "b"]);
    const onChange = vi.fn();
    render(<Probe ids={["a", "b"]} onChange={onChange} />);

    act(() => {
      lastCallback!([
        {
          isIntersecting: false,
          target: document.getElementById("b")!,
          boundingClientRect: { top: 50 },
        },
      ]);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("disconnects the observer on unmount", () => {
    setupSections(["a"]);
    const { unmount } = render(<Probe ids={["a"]} onChange={() => {}} />);
    unmount();
    expect(disconnected).toBe(true);
  });

  it("keeps `a` active when `b` enters via a partial batch (delta semantics)", () => {
    // Real IntersectionObserver only emits entries that CHANGED since
    // the previous callback. The hook must therefore track the full
    // intersecting set across callbacks — not just the current batch.
    setupSections(["a", "b"]);
    const onChange = vi.fn();
    render(<Probe ids={["a", "b"]} onChange={onChange} />);

    // First batch: `a` enters at top 50.
    act(() => {
      lastCallback!([
        {
          isIntersecting: true,
          target: document.getElementById("a")!,
          boundingClientRect: { top: 50 },
        },
      ]);
    });
    expect(onChange).toHaveBeenLastCalledWith("a");

    // Second batch: only `b` is in this delta (entered at top 200).
    // `a` is unchanged so IO does NOT report it. The hook should
    // remember `a` is still intersecting and keep `a` active because
    // it's still topmost.
    act(() => {
      lastCallback!([
        {
          isIntersecting: true,
          target: document.getElementById("b")!,
          boundingClientRect: { top: 200 },
        },
      ]);
    });
    expect(onChange).toHaveBeenLastCalledWith("a");

    // Third batch: `a` leaves. Now `b` should win.
    act(() => {
      lastCallback!([
        {
          isIntersecting: false,
          target: document.getElementById("a")!,
          boundingClientRect: { top: -50 },
        },
      ]);
    });
    expect(onChange).toHaveBeenLastCalledWith("b");
  });

  it("walks through every section as the user scrolls top to bottom", () => {
    const ids = ["a", "b", "c", "d", "e"];
    setupSections(ids);
    const onChange = vi.fn();
    render(<Probe ids={ids} onChange={onChange} />);

    // Simulate scroll: at each step the named section is the topmost
    // intersecting one in the band. The test mimics the user scrolling
    // through the page section-by-section.
    for (const id of ids) {
      act(() => {
        lastCallback!(
          ids.map((sectionId, i) => ({
            isIntersecting: sectionId === id,
            target: document.getElementById(sectionId)!,
            boundingClientRect: { top: i * 100 },
          })),
        );
      });
    }

    expect(onChange.mock.calls.map((c) => c[0])).toEqual(ids);
  });
});
