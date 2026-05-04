"use client";
import { HealthDot } from "./HealthDot";
import { Logo } from "./Logo";
import { NavContent } from "./NavContent";

export function Sidebar() {
  return (
    <aside className="hidden md:flex h-screen w-56 flex-col border-r border-border bg-card px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-3">
        <Logo size="lg" />
        <HealthDot />
      </div>
      <NavContent />
    </aside>
  );
}
