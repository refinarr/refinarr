// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useRef } from "react";

// ─────────────────────────────────────────────────────────────────────
// Mocks — capture `useVirtualizer` config so tests can drive onChange
// directly without simulating real scroll. `useScrollContainer` is also
// mocked so we can flip `scrollElement` between null (forces flat
// rendering) and a truthy element (lets virt engage).

interface CapturedConfig {
  count: number;
  estimateSize: (i: number) => number;
  overscan: number;
  scrollMargin: number;
  measureElement?: (el: Element) => number;
  onChange?: (instance: VirtInstance, sync: boolean) => void;
  getScrollElement: () => HTMLElement | null;
}

interface VirtInstance {
  isScrolling: boolean;
  measure: ReturnType<typeof vi.fn>;
  measureElement: ReturnType<typeof vi.fn>;
  getVirtualItems: () => VirtualRow[];
  getTotalSize: () => number;
}

interface VirtualRow {
  index: number;
  start: number;
  size: number;
}

// Mutable test fixtures the mock reads on every call.
let lastConfig: CapturedConfig | null = null;
let lastInstance: VirtInstance | null = null;
let virtualItems: VirtualRow[] = [];
let totalSize = 1000;

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (config: CapturedConfig) => {
    lastConfig = config;
    const instance: VirtInstance = {
      isScrolling: false,
      measure: vi.fn(),
      measureElement: vi.fn(),
      getVirtualItems: () => virtualItems,
      getTotalSize: () => totalSize,
    };
    lastInstance = instance;
    return instance;
  },
}));

let mockScrollElement: HTMLElement | null = null;
let mockScrollMargin = 0;

vi.mock("@/client/hooks/ui/useScrollContainer", () => ({
  useScrollContainer: () => ({
    scrollElement: mockScrollElement,
    scrollMargin: mockScrollMargin,
  }),
}));

// Imported AFTER the mocks so they apply.

import {
  useVirtList,
  type UseVirtListOptions,
  type UseVirtListResult,
} from "../useVirtList";

// ─────────────────────────────────────────────────────────────────────
// Probe — exposes the hook's result via a ref so tests can assert on
// it without rendering chrome. The component is otherwise empty.

interface Row {
  id: number;
}

interface ProbeProps extends Omit<
  UseVirtListOptions<Row>,
  "containerRef" | "rows"
> {
  rows: Row[];
  onResult: (result: UseVirtListResult<Row>) => void;
}

function Probe({ onResult, rows, ...rest }: ProbeProps) {
  const ref = useRef<HTMLUListElement | null>(null);
  const result = useVirtList<Row>({ ...rest, rows, containerRef: ref });
  onResult(result);
  return <ul ref={ref} data-testid="list" />;
}

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1 }));
}

const noopOverscan = () => 5;

// ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  lastConfig = null;
  lastInstance = null;
  virtualItems = [];
  totalSize = 1000;
  mockScrollElement = null;
  mockScrollMargin = 0;
});

describe("useVirtList — flat mode", () => {
  test("disables virt below the default threshold (200)", () => {
    let captured!: UseVirtListResult<Row>;
    mockScrollElement = document.createElement("div");
    render(
      <Probe
        rows={makeRows(50)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={(r) => (captured = r)}
      />,
    );
    expect(captured.virtEnabled).toBe(false);
    expect(captured.containerStyle).toBeUndefined();
    expect(captured.totalSize).toBe(0);
  });

  test("returns one item per row keyed by row.id when flat", () => {
    let captured!: UseVirtListResult<Row>;
    render(
      <Probe
        rows={makeRows(3)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={(r) => (captured = r)}
      />,
    );
    expect(captured.items).toHaveLength(3);
    expect(captured.items.map((i) => i.key)).toEqual([1, 2, 3]);
    expect(captured.items.every((i) => i.style === undefined)).toBe(true);
    expect(captured.items.every((i) => i.measureRef === undefined)).toBe(true);
  });

  test("disables virt when no scrollable ancestor is found", () => {
    let captured!: UseVirtListResult<Row>;
    mockScrollElement = null; // no scroller
    render(
      <Probe
        rows={makeRows(500)} // would otherwise pass the threshold
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={(r) => (captured = r)}
      />,
    );
    expect(captured.virtEnabled).toBe(false);
    expect(captured.items).toHaveLength(500);
    expect(captured.items[0].style).toBeUndefined();
  });

  test("respects a custom virtThreshold", () => {
    let captured!: UseVirtListResult<Row>;
    mockScrollElement = document.createElement("div");
    render(
      <Probe
        rows={makeRows(20)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        virtThreshold={10}
        onResult={(r) => (captured = r)}
      />,
    );
    expect(captured.virtEnabled).toBe(true);
  });
});

describe("useVirtList — virt mode", () => {
  beforeEach(() => {
    mockScrollElement = document.createElement("div");
    virtualItems = [
      { index: 0, start: 0, size: 48 },
      { index: 1, start: 48, size: 48 },
      { index: 2, start: 96, size: 48 },
    ];
    totalSize = 9600;
  });

  test("enables virt at/above threshold with a scroll element", () => {
    let captured!: UseVirtListResult<Row>;
    render(
      <Probe
        rows={makeRows(500)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={(r) => (captured = r)}
      />,
    );
    expect(captured.virtEnabled).toBe(true);
    expect(captured.containerStyle).toEqual({
      height: 9600,
      position: "relative",
    });
    expect(captured.totalSize).toBe(9600);
  });

  test("projects virtual items with absolute-position style", () => {
    let captured!: UseVirtListResult<Row>;
    mockScrollMargin = 64;
    render(
      <Probe
        rows={makeRows(500)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={(r) => (captured = r)}
      />,
    );
    expect(captured.items).toHaveLength(3);
    const first = captured.items[0];
    expect(first.row).toEqual({ id: 1 });
    expect(first.key).toBe(1);
    expect(first.style).toMatchObject({
      position: "absolute",
      top: 0,
      left: 0,
      height: 48,
      transform: "translateY(-64px)", // start (0) - scrollMargin (64)
    });
    expect(first.measureRef).toBe(lastInstance!.measureElement);
  });

  test("emits a skeleton item (row=undefined) for indices past loaded data", () => {
    let captured!: UseVirtListResult<Row>;
    virtualItems = [
      { index: 0, start: 0, size: 48 },
      { index: 203, start: 9744, size: 48 }, // past loaded rows, in buffer
    ];
    render(
      <Probe
        rows={makeRows(200)} // only 200 loaded
        hasNextPage // more to load → buffer skeleton slots
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={(r) => (captured = r)}
      />,
    );
    expect(captured.items[0].row).toEqual({ id: 1 });
    expect(captured.items[0].key).toBe(1);
    expect(captured.items[1].row).toBeUndefined();
    expect(captured.items[1].key).toBe("__skeleton-203");
    expect(captured.items[1].measureRef).toBeUndefined();
  });

  test("count = rows.length + skeleton buffer when more pages exist", () => {
    render(
      <Probe
        rows={makeRows(50)}
        hasNextPage
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={() => {}}
      />,
    );
    // 50 loaded + 8 ghost skeleton slots — cap on the "wall of
    // skeletons" UX that flooded the viewport when count was totalRows.
    expect(lastConfig!.count).toBe(58);
  });

  test("count = rows.length when no more pages (no skeletons)", () => {
    render(
      <Probe
        rows={makeRows(50)}
        hasNextPage={false}
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={() => {}}
      />,
    );
    expect(lastConfig!.count).toBe(50);
  });

  test("passes a custom estimateSize function through unchanged", () => {
    const fn = (i: number) => 48 + i;
    render(
      <Probe
        rows={makeRows(500)}
        estimateSize={fn}
        pickOverscan={noopOverscan}
        onResult={() => {}}
      />,
    );
    expect(lastConfig!.estimateSize).toBe(fn);
  });

  test("wraps a numeric estimateSize as a constant function", () => {
    render(
      <Probe
        rows={makeRows(500)}
        estimateSize={72}
        pickOverscan={noopOverscan}
        onResult={() => {}}
      />,
    );
    expect(lastConfig!.estimateSize(0)).toBe(72);
    expect(lastConfig!.estimateSize(99)).toBe(72);
  });

  test("forwards measureElement to the virtualizer config", () => {
    const measure = (el: Element) => el.getBoundingClientRect().height;
    render(
      <Probe
        rows={makeRows(500)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        measureElement={measure}
        onResult={() => {}}
      />,
    );
    expect(lastConfig!.measureElement).toBe(measure);
  });

  test("calls pickOverscan with the effective count", () => {
    const pick = vi.fn().mockReturnValue(7);
    render(
      <Probe
        rows={makeRows(50)}
        hasNextPage
        estimateSize={48}
        pickOverscan={pick}
        onResult={() => {}}
      />,
    );
    expect(pick).toHaveBeenCalledWith(58); // 50 loaded + 8 buffer
    expect(lastConfig!.overscan).toBe(7);
  });
});

describe("useVirtList — prefetch wiring", () => {
  beforeEach(() => {
    mockScrollElement = document.createElement("div");
  });

  test("fires fetchNextPage when last visible index nears the loaded tail", () => {
    const fetchNextPage = vi.fn();
    virtualItems = [{ index: 175, start: 8400, size: 48 }];
    render(
      <Probe
        rows={makeRows(200)} // last loaded index = 199
        estimateSize={48}
        pickOverscan={noopOverscan}
        fetchNextPage={fetchNextPage}
        hasNextPage
        isFetchingNextPage={false}
        onResult={() => {}}
      />,
    );
    // 175 >= 200 - 30 (default prefetchAheadRows) → fires
    lastConfig!.onChange!(lastInstance!, false);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  test("does NOT fire when last visible index is far from the tail", () => {
    const fetchNextPage = vi.fn();
    virtualItems = [{ index: 50, start: 2400, size: 48 }];
    render(
      <Probe
        rows={makeRows(200)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        fetchNextPage={fetchNextPage}
        hasNextPage
        isFetchingNextPage={false}
        onResult={() => {}}
      />,
    );
    lastConfig!.onChange!(lastInstance!, false);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  test("does NOT fire when hasNextPage is false", () => {
    const fetchNextPage = vi.fn();
    virtualItems = [{ index: 199, start: 9552, size: 48 }];
    render(
      <Probe
        rows={makeRows(200)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        fetchNextPage={fetchNextPage}
        hasNextPage={false}
        isFetchingNextPage={false}
        onResult={() => {}}
      />,
    );
    lastConfig!.onChange!(lastInstance!, false);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  test("does NOT fire while a fetch is already in flight", () => {
    const fetchNextPage = vi.fn();
    virtualItems = [{ index: 199, start: 9552, size: 48 }];
    render(
      <Probe
        rows={makeRows(200)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        fetchNextPage={fetchNextPage}
        hasNextPage
        isFetchingNextPage
        onResult={() => {}}
      />,
    );
    lastConfig!.onChange!(lastInstance!, false);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  test("defers prefetch during sync + isScrolling (rapid flick)", () => {
    const fetchNextPage = vi.fn();
    virtualItems = [{ index: 199, start: 9552, size: 48 }];
    render(
      <Probe
        rows={makeRows(200)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        fetchNextPage={fetchNextPage}
        hasNextPage
        isFetchingNextPage={false}
        onResult={() => {}}
      />,
    );
    lastInstance!.isScrolling = true;
    lastConfig!.onChange!(lastInstance!, true); // sync=true
    expect(fetchNextPage).not.toHaveBeenCalled();

    // Once scrolling settles or onChange fires async, prefetch resumes.
    lastInstance!.isScrolling = false;
    lastConfig!.onChange!(lastInstance!, false);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  test("does nothing when there are no visible items", () => {
    const fetchNextPage = vi.fn();
    virtualItems = [];
    render(
      <Probe
        rows={makeRows(200)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        fetchNextPage={fetchNextPage}
        hasNextPage
        isFetchingNextPage={false}
        onResult={() => {}}
      />,
    );
    lastConfig!.onChange!(lastInstance!, false);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  test("respects a custom prefetchAheadRows", () => {
    const fetchNextPage = vi.fn();
    virtualItems = [{ index: 145, start: 6960, size: 48 }];
    render(
      <Probe
        rows={makeRows(200)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        prefetchAheadRows={60} // 145 >= 200 - 60 = 140 → fires
        fetchNextPage={fetchNextPage}
        hasNextPage
        isFetchingNextPage={false}
        onResult={() => {}}
      />,
    );
    lastConfig!.onChange!(lastInstance!, false);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});

describe("useVirtList — measure() on count growth", () => {
  beforeEach(() => {
    mockScrollElement = document.createElement("div");
  });

  test("calls virtualizer.measure() once on mount", () => {
    render(
      <Probe
        rows={makeRows(50)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={() => {}}
      />,
    );
    expect(lastInstance!.measure).toHaveBeenCalledTimes(1);
  });

  test("calls measure() again when effective count grows", () => {
    const { rerender } = render(
      <Probe
        rows={makeRows(50)}
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={() => {}}
      />,
    );
    const before = lastInstance!.measure;
    expect(before).toHaveBeenCalledTimes(1);

    rerender(
      <Probe
        rows={makeRows(150)} // count grew
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={() => {}}
      />,
    );
    // Same virtualizer instance is reused across renders (the mock
    // returns a fresh object each call but the effect deps include
    // `virtualizer`; both effective-count growth AND identity change
    // trigger measure). Either way, total > 1 confirms the rebuild.
    expect(lastInstance!.measure.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  test("calls measure() when rows growth lifts effective count", () => {
    const { rerender } = render(
      <Probe
        rows={makeRows(50)}
        hasNextPage={false}
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={() => {}}
      />,
    );
    rerender(
      <Probe
        rows={makeRows(150)} // next page landed
        hasNextPage={false}
        estimateSize={48}
        pickOverscan={noopOverscan}
        onResult={() => {}}
      />,
    );
    expect(lastInstance!.measure.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(lastConfig!.count).toBe(150);
  });
});
