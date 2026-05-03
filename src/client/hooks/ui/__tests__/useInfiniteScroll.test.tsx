// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useInfiniteScroll } from "../useInfiniteScroll";

interface ObserverInstance {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  trigger: (intersecting: boolean) => void;
}

const observers: ObserverInstance[] = [];

beforeEach(() => {
  observers.length = 0;
  class MockIO {
    private cb: IntersectionObserverCallback;
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
      observers.push({
        observe: this.observe,
        disconnect: this.disconnect,
        trigger: (intersecting) =>
          this.cb(
            [{ isIntersecting: intersecting } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          ),
      });
    }
    unobserve = vi.fn();
    takeRecords = () => [] as IntersectionObserverEntry[];
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  vi.stubGlobal("IntersectionObserver", MockIO);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

interface ProbeProps {
  onLoadMore: () => void;
  hasMore: boolean;
}

function Probe({ onLoadMore, hasMore }: ProbeProps) {
  const ref = useInfiniteScroll(onLoadMore, hasMore);
  return <div data-testid="sentinel" ref={ref} />;
}

describe("useInfiniteScroll", () => {
  test("installs an observer on the sentinel when hasMore=true", () => {
    render(<Probe onLoadMore={() => {}} hasMore />);
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalled();
  });

  test("does NOT install an observer when hasMore=false", () => {
    render(<Probe onLoadMore={() => {}} hasMore={false} />);
    expect(observers).toHaveLength(0);
  });

  test("calls onLoadMore when the sentinel intersects", () => {
    const onLoadMore = vi.fn();
    render(<Probe onLoadMore={onLoadMore} hasMore />);
    act(() => observers[0].trigger(true));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  test("does NOT call onLoadMore when the sentinel is not intersecting", () => {
    const onLoadMore = vi.fn();
    render(<Probe onLoadMore={onLoadMore} hasMore />);
    act(() => observers[0].trigger(false));
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  test("disconnects on unmount", () => {
    const { unmount } = render(<Probe onLoadMore={() => {}} hasMore />);
    const obs = observers[0];
    unmount();
    expect(obs.disconnect).toHaveBeenCalled();
  });
});
