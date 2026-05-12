"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Film, LayoutDashboard, Menu, Tv2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePrefersReducedMotion } from "@/client/hooks/ui/useMediaQuery";
import { useScrollDirection } from "@/client/hooks/ui/useScrollDirection";
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
  // Auto-hide on scroll-down to give content more screen real estate;
  // re-show the moment the user scrolls up. Drawer-open state suppresses
  // the hide so the tab bar's "More" button doesn't slip away mid-tap.
  const direction = useScrollDirection();
  const prefersReducedMotion = usePrefersReducedMotion();
  const hidden = direction === "down" && !moreOpen;
  return (
    <nav
      aria-label={t("primary")}
      className={cn(
        "bg-card/90 border-border/60 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden",
        // translate-y-full slides the bar past its own height; the
        // safe-area padding sits inside the bar so it slides with us.
        // prefers-reduced-motion replaces the slide with an instant
        // toggle so motion-sensitive users still get the layout
        // affordance without the animation.
        prefersReducedMotion ? "" : "transition-transform duration-200",
        hidden && "translate-y-full",
      )}
    >
      <div className="h-bottom-bar flex items-stretch">
        {TABS.map(({ href, labelKey, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/" && pathname.startsWith(`${href}/`));
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
