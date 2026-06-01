"use client";
import { useEffect, useState } from "react";
import { cn } from "@/client/lib/utils";
import { Logo } from "./Logo";
import { NavContent } from "./NavContent";

interface Props {
  open: boolean;
}

export function Sidebar({ open }: Props) {
  // useSidebarOpen's server/first-paint snapshot is `false`, but on desktop
  // the real value resolves to `true` right after hydration. Rendering the
  // closed (w-0) state first and then animating to w-56 slid the entire
  // right column on every cold page load — the dominant app-wide CLS.
  //
  // Fix: render OPEN until the client has mounted and explicitly reports
  // closed. So the first desktop paint is already w-56 (matching the default
  // open state the bench/most users see) → no width correction, no shift.
  // Only a user who has explicitly persisted "closed" sees a one-time
  // collapse, and the transition is gated to `mounted` so the initial
  // settle never animates.
  const [mounted, setMounted] = useState(false);
  // Mount flag is the whole point — we deliberately want a post-paint
  // re-render so the first paint stays animation-free and open. The
  // set-state-in-effect advisory doesn't have a cleaner alternative for
  // "have we painted once yet" (same as AppShell's resize reset).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const collapsed = mounted && !open;

  return (
    <aside
      aria-hidden={collapsed}
      className={cn(
        "border-border bg-card hidden h-full flex-col overflow-hidden border-r md:flex",
        mounted && "transition-[width] duration-200",
        collapsed ? "w-0 p-0" : "w-56 px-3 py-4",
      )}
    >
      {!collapsed && (
        <>
          {/* Brand sits at the top of the sidebar (qui-pattern). The
              outer page header on the right column intentionally has no
              brand — instead it carries page-specific chrome. */}
          <div className="mb-4 flex items-center px-1">
            <Logo size="md" />
          </div>
          <NavContent />
        </>
      )}
    </aside>
  );
}
