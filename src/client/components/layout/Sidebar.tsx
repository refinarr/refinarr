"use client";
import { cn } from "@/client/lib/utils";
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
      {open && <NavContent />}
    </aside>
  );
}
