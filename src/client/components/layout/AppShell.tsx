"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/client/components/ui/sheet";
import { useSidebarOpen } from "@/client/hooks/ui/useSidebarOpen";
import { cn } from "@/client/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { KeyboardHelpDialog } from "./KeyboardHelpDialog";
import { MobileTabBar } from "./MobileTabBar";
import { NavContent } from "./NavContent";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

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
}

export function AppShell({ children, pageHeader }: Props) {
  const tA11y = useTranslations("a11y");
  const tNav = useTranslations("nav");
  // Desktop sidebar state — persisted, slides the inline rail in/out.
  const desktopSidebar = useSidebarOpen();
  // Mobile More drawer — opens from the bottom tab bar's "More" tab,
  // closes on navigate or when the viewport crosses into desktop.
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const closeMoreOnDesktop = () => {
      if (mql.matches) setMoreOpen(false);
    };
    closeMoreOnDesktop();
    mql.addEventListener("change", closeMoreOnDesktop);
    return () => mql.removeEventListener("change", closeMoreOnDesktop);
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <a
        href="#main"
        className="focus:bg-primary focus:text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none"
      >
        {tA11y("skipToContent")}
      </a>
      <TopHeader onToggleSidebar={desktopSidebar.toggle} />

      <div className="flex flex-1 overflow-hidden">
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

        <div className="flex flex-1 flex-col overflow-hidden">
          {pageHeader}
          <main
            id="main"
            tabIndex={-1}
            className={cn(
              "flex-1 overflow-y-auto px-4 pb-[calc(var(--spacing-bottom-bar)+var(--spacing-page)+env(safe-area-inset-bottom))] focus:outline-none md:px-6 md:pb-6",
              pageHeader ? "pt-section md:pt-page" : "pt-4 md:pt-6",
            )}
          >
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar onMoreClick={() => setMoreOpen(true)} moreOpen={moreOpen} />

      <CommandPalette />
      <KeyboardHelpDialog />
    </div>
  );
}
