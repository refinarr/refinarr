"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Film, LayoutDashboard, Menu, Tv2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { ARR_LIBRARY_ROUTE } from "@/shared/arr-type";

interface TabKey {
  href: string;
  labelKey: "dashboard" | "movies" | "shows";
  icon: LucideIcon;
}

const TABS: TabKey[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: ARR_LIBRARY_ROUTE.radarr, labelKey: "movies", icon: Film },
  { href: ARR_LIBRARY_ROUTE.sonarr, labelKey: "shows", icon: Tv2 },
];

interface Props {
  onMoreClick: () => void;
  moreOpen: boolean;
}

// Mobile-only bottom navigation bar (`md:hidden`). Three primary
// routes + a "More" button that opens the AppShell's drawer for
// secondary destinations (Ignored / Queue / History / Logs / Settings).
//
// Sits at the AppShell flex level (sibling to <main>) and is
// `position: fixed` so it stays above scrolling content. Inner padding
// honours the iOS home-indicator safe area.
export function MobileTabBar({ onMoreClick, moreOpen }: Props) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav
      aria-label={t("primary")}
      className="bg-card/90 border-border/60 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16 items-stretch">
        {TABS.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 px-2 text-xs font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              <span className="truncate">{t(labelKey)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMoreClick}
          aria-expanded={moreOpen}
          aria-label={t("openMore")}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 px-2 text-xs font-medium transition-colors",
            moreOpen
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Menu className="size-5" />
          <span className="truncate">{t("more")}</span>
        </button>
      </div>
    </nav>
  );
}
