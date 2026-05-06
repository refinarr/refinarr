"use client";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/client/components/ui/sheet";
import { useSidebarOpen } from "@/client/hooks/ui/useSidebarOpen";
import { CommandPalette } from "./CommandPalette";
import { KeyboardHelpDialog } from "./KeyboardHelpDialog";
import { Logo } from "./Logo";
import { NavContent } from "./NavContent";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  const tA11y = useTranslations("a11y");
  const tNav = useTranslations("nav");
  // Desktop sidebar state — persisted, slides the inline rail in/out.
  const desktopSidebar = useSidebarOpen();
  // Mobile drawer is ephemeral — opens via the same hamburger when the
  // viewport is below md, never persisted.
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggle = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      desktopSidebar.toggle();
    } else {
      setMobileOpen((v) => !v);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <a
        href="#main"
        className="focus:bg-primary focus:text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none"
      >
        {tA11y("skipToContent")}
      </a>
      <TopHeader onToggleSidebar={handleToggle} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={desktopSidebar.open} />

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex flex-col gap-0 px-3 py-4">
            <SheetTitle className="mb-6 px-3">
              <Logo size="lg" />
            </SheetTitle>
            <SheetDescription className="sr-only">
              {tNav("menu")}
            </SheetDescription>
            <NavContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <main
          id="main"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] focus:outline-none md:p-6 md:pb-6"
        >
          {children}
        </main>
      </div>

      <CommandPalette />
      <KeyboardHelpDialog />
    </div>
  );
}
