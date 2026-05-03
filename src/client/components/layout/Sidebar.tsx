"use client";
import { useTranslations } from "next-intl";
import { HealthDot } from "./HealthDot";
import { NavContent } from "./NavContent";

export function Sidebar() {
  const tApp = useTranslations();
  return (
    <aside className="hidden md:flex h-screen w-56 flex-col border-r border-border bg-card px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-3">
        <span className="text-lg font-bold tracking-tight">{tApp("appName")}</span>
        <HealthDot />
      </div>
      <NavContent />
    </aside>
  );
}
