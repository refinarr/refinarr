"use client";
import { cn } from "@/client/lib/utils";
import { Logo } from "./Logo";
import { NavContent } from "./NavContent";

interface Props {
  open: boolean;
}

export function Sidebar({ open }: Props) {
  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "border-border bg-card hidden h-full flex-col overflow-hidden border-r transition-[width] duration-200 md:flex",
        open ? "w-56 px-3 py-4" : "w-0 p-0",
      )}
    >
      {open && (
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
