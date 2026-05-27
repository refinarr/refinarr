"use client";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ArrowUp } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { cn } from "@/client/lib/utils";

// Show the button once the user has scrolled at least this far. One
// full mobile viewport (~600px) keeps it out of the way for short
// lists; only appears when scrolling-back-up is actually useful.
const SCROLL_THRESHOLD_PX = 600;

// MediaTable + MediaCardList both tag their `overflow-auto` div with
// `data-scroll-root` (useScrollDirection uses the same hook). We
// reuse it instead of inventing a parallel attribute.
const SCROLL_ROOT_SELECTOR = "[data-scroll-root]";

function findScrollRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SCROLL_ROOT_SELECTOR);
}

// `useSyncExternalStore`'s subscribe: install a MutationObserver to
// catch the scroll-root swapping (desktop table ↔ mobile card list),
// and a passive scroll listener on whichever container is current.
// Calls `notify` whenever either signal changes; the component then
// re-reads visibility via `getVisibility`.
function subscribe(notify: () => void): () => void {
  let current = findScrollRoot();
  let scrollHandler: (() => void) | null = null;

  function attach(el: HTMLElement | null) {
    if (scrollHandler && current) {
      current.removeEventListener("scroll", scrollHandler);
    }
    current = el;
    if (el) {
      scrollHandler = notify;
      el.addEventListener("scroll", notify, { passive: true });
    }
  }

  attach(current);
  const obs = new MutationObserver(() => {
    const next = findScrollRoot();
    if (next !== current) {
      attach(next);
      notify();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  return () => {
    obs.disconnect();
    if (scrollHandler && current) {
      current.removeEventListener("scroll", scrollHandler);
    }
  };
}

function getVisibility(): boolean {
  const c = findScrollRoot();
  return c ? c.scrollTop > SCROLL_THRESHOLD_PX : false;
}

// SSR snapshot — no scroll state on the server, so the button is
// hidden during hydration.
function getServerVisibility(): boolean {
  return false;
}

/**
 * Portal-rendered "back to top" pill. Finds whichever
 * `data-scroll-root` is currently mounted (MediaTable on desktop /
 * MediaCardList on mobile), tracks its scrollTop, and renders a fixed
 * bottom-right button once the user is more than one viewport down.
 * Click smooth-scrolls the same container back to 0.
 *
 * Mobile position composes with `--spacing-bottom-bar` /
 * `--spacing-mobile-filter-bar` so the button clears the nav stack
 * when both bars are visible. When the BulkActionToolbar opens
 * (`<html data-bulk-bar="open">`) those bars slide out, so the button
 * drops down to the same vertical line as the bulk pill — sitting in
 * the right corner alongside the centered pill rather than orphaned
 * mid-screen above an empty zone.
 */
export function ScrollToTopButton() {
  const t = useTranslations("common");
  const visible = useSyncExternalStore(
    subscribe,
    getVisibility,
    getServerVisibility,
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={() => findScrollRoot()?.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("scrollToTop")}
      title={t("scrollToTop")}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        "fixed right-3 z-40 rounded-full shadow-lg md:right-6",
        // Mobile (no selection): clear the tab bar + filter bar + iOS
        // safe-area. Desktop: just a small gap from the viewport edge.
        "bottom-[calc(env(safe-area-inset-bottom)+var(--spacing-bottom-bar)+var(--spacing-mobile-filter-bar)+0.5rem)] md:bottom-6",
        // Mobile + selection mode: nav stack is hidden, drop the
        // button down to sit alongside the bulk pill (right corner,
        // same vertical line) instead of orphaning it mid-screen.
        // Desktop is unaffected — md:bottom-6 already wins above.
        "max-md:[html[data-bulk-bar=open]_&]:bottom-[max(env(safe-area-inset-bottom),0.75rem)]",
        // Toggle in/out as the threshold crosses. motion-reduce
        // collapses the slide into an instant swap.
        "motion-safe:transition-[transform,opacity] motion-safe:duration-150 motion-safe:ease-out",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp />
    </Button>,
    document.body,
  );
}
