"use client";
import {
  useLayoutEffect,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";

interface Result {
  // The nearest scrollable ancestor of the ref's element. Falls back to
  // AppShell's `<main>` (id="main") if no scrollable parent is found.
  scrollElement: HTMLElement | null;
  // The ref'd element's offset within the scroller's content. Pass to
  // useVirtualizer's `scrollMargin` so virt geometry is accurate when
  // the list lives below other page chrome.
  scrollMargin: number;
}

// Find the nearest scrollable ancestor of an element and track its
// offset within that scroller's content. Used inside useVirtList —
// each consumer owns its own ref and gets its own scroll context
// without threading state through a parent.
//
// Re-measures on element resize (sticky header height shift, density
// change, font load) and on window resize. The +scrollTop term keeps
// the formula invariant under scroll, so we don't need to re-run on
// every scroll event.
export function useScrollContainer(
  elementRef:
    | RefObject<HTMLElement | null>
    | MutableRefObject<HTMLElement | null>,
): Result {
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const node = elementRef.current;
    if (!node) return;

    let scroller: HTMLElement | null = null;
    let parent = node.parentElement;
    while (parent) {
      const overflow = window.getComputedStyle(parent).overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        scroller = parent;
        break;
      }
      parent = parent.parentElement;
    }
    if (!scroller) scroller = document.getElementById("main");
    setScrollElement(scroller);

    const measure = () => {
      if (!scroller) return;
      const elTop = node.getBoundingClientRect().top;
      const scrollerTop = scroller.getBoundingClientRect().top;
      setScrollMargin(elTop - scrollerTop + scroller.scrollTop);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [elementRef]);

  return { scrollElement, scrollMargin };
}
