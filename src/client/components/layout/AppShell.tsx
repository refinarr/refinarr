"use client";
import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/client/components/ui/sheet";
import { useMediaQuery } from "@/client/hooks/ui/useMediaQuery";
import { useSidebarOpen } from "@/client/hooks/ui/useSidebarOpen";
import { cn } from "@/client/lib/utils";
import { MobileTabBar } from "./MobileTabBar";
import { NavContent } from "./NavContent";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

// Lazy-loaded: both are mounted on every page but only used behind a
// keyboard shortcut (Cmd+K / "?"). Code-splitting them (incl. cmdk) keeps
// them out of the initial bundle; their global key listeners attach once
// the chunk loads shortly after hydration. ssr:false — they're client-only
// overlays with nothing to render on the server.
const CommandPalette = dynamic(
  () => import("./CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);
const KeyboardHelpDialog = dynamic(
  () => import("./KeyboardHelpDialog").then((m) => m.KeyboardHelpDialog),
  { ssr: false },
);

// Routes already represented in the bottom tab bar are hidden from
// the More drawer to avoid duplicate entry points.
const MORE_DRAWER_EXCLUDE = new Set(["dashboard", "movies", "shows"] as const);

interface Props {
  children: ReactNode;
  // Renders between TopHeader and <main>. Use this for page-level
  // headers (titles, tab pickers) that should not scroll with content.
  // Placing them at the flex layout level instead of inside <main>
  // means they stay pinned on every viewport and iOS rubber-band
  // overscroll inside <main> can't drag them around.
  pageHeader?: ReactNode;
  // Per-page chrome rendered INSIDE the TopHeader (between Logo and
  // the right group). Used by MediaListShell to surface the unified
  // page bar — instance picker, scoring mode, density, refresh, bulk
  // actions, search — so chrome height stays constant and (de)selecting
  // doesn't jump the layout. Desktop-only (md+).
  topHeaderSlot?: ReactNode;
  // Renders inside the TopHeader on its OWN row (via basis-full), so
  // the main row stays single-line and chrome stays vertically aligned.
  // Used by MediaListShell for the bulk-action toolbar.
  topHeaderBelowSlot?: ReactNode;
  // Who owns the scrollbar?
  //   • "page" (default): <main> scrolls vertically; AppShell wraps
  //     children in a padded block. Sticky descendants pin to <main>'s
  //     top. Good for typical document-flow pages (settings, dashboard).
  //   • "viewport": <main> becomes a non-scrolling flex column;
  //     children own their padding AND their own scrolling. Required
  //     by pages with a resizable table whose wrapper needs to be the
  //     scroll container in both axes (sticky table header pins
  //     correctly when the wrapper itself is at a stable viewport
  //     position). Mirrors qui's TorrentTable layout.
  scrollMode?: "page" | "viewport";
}

export function AppShell({
  children,
  pageHeader,
  topHeaderSlot,
  topHeaderBelowSlot,
  scrollMode = "page",
}: Props) {
  const tA11y = useTranslations("a11y");
  const tNav = useTranslations("nav");
  // Desktop sidebar state — persisted, slides the inline rail in/out.
  const desktopSidebar = useSidebarOpen();
  // Mobile More drawer — opens from the bottom tab bar's "More" tab,
  // closes on navigate or when the viewport crosses into desktop.
  const [moreOpen, setMoreOpen] = useState(false);

  // Auto-close the mobile More drawer the moment the viewport crosses
  // into desktop. The setState is intentional state-sync rather than a
  // missed-event-handler — when the user resizes from mobile to desktop
  // there's no event we could attach `setMoreOpen(false)` to. The
  // react-hooks/set-state-in-effect advisory is correct in spirit but
  // doesn't have a cleaner alternative for this resize-driven reset.
  const isMdUp = useMediaQuery("(min-width: 768px)");
  useEffect(() => {
    if (!isMdUp) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoreOpen(false);
  }, [isMdUp]);

  return (
    // qui-pattern: Sidebar takes full height as the left column,
    // TopHeader lives INSIDE the right column (sibling of <main>) — not
    // above the whole layout. The brand wordmark sits at the top of the
    // sidebar; the right column carries page-specific chrome only.
    <div className="bg-background flex h-dvh overflow-hidden">
      <a
        href="#main"
        className="focus:bg-primary focus:text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none"
      >
        {tA11y("skipToContent")}
      </a>
      <Sidebar open={desktopSidebar.open} />

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 px-3 py-4">
          <SheetTitle className="mb-6 px-3">{tNav("more")}</SheetTitle>
          <SheetDescription className="sr-only">
            {tNav("primary")}
          </SheetDescription>
          <NavContent
            onNavigate={() => setMoreOpen(false)}
            excludeKeys={MORE_DRAWER_EXCLUDE}
          />
        </SheetContent>
      </Sheet>

      {/* min-w-0 lets table content with intrinsic min-width still shrink
          inside the right column — without it, flex-1 children with
          overflowing min-content can push past the column boundary. */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader
          onToggleSidebar={desktopSidebar.toggle}
          slot={topHeaderSlot}
          belowSlot={topHeaderBelowSlot}
        />
        {pageHeader}
        {scrollMode === "viewport" ? (
          <main
            id="main"
            tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col overflow-hidden focus:outline-none"
          >
            {children}
          </main>
        ) : (
          <main
            id="main"
            tabIndex={-1}
            className="flex-1 overflow-y-auto focus:outline-none"
          >
            {/*
              Padding lives on this inner wrapper, NOT on <main>. Putting
              it on main would offset position: sticky descendants from
              main's top edge by `pt-...`, making sticky table headers
              appear to "float" 24px below the page top. With padding on
              the inner wrapper, sticky pins flush to main's content-box
              (== border-box, since main has no padding) and the padding
              scrolls with the rest of the content.
            */}
            <div
              className={cn(
                "md:pb-page px-4 pb-[calc(var(--spacing-bottom-bar)+var(--spacing-page)+env(safe-area-inset-bottom))] md:px-6",
                pageHeader
                  ? "pt-section md:pt-page"
                  : "pt-content-top md:pt-page",
              )}
            >
              {children}
            </div>
          </main>
        )}
      </div>

      <MobileTabBar onMoreClick={() => setMoreOpen(true)} moreOpen={moreOpen} />

      <CommandPalette />
      <KeyboardHelpDialog />
    </div>
  );
}
