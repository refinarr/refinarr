"use client";
import { useTranslations } from "next-intl";
import { Search, Trash2, EyeOff, X } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { usePrefersReducedMotion } from "@/client/hooks/ui/useMediaQuery";
import { useScrollDirection } from "@/client/hooks/ui/useScrollDirection";
import { cn } from "@/client/lib/utils";
import type { BulkProgress } from "./types";

interface Props {
  selectedCount: number;
  onSearch: () => void;
  onDelete: (search: boolean) => void;
  onIgnore: () => void;
  disabled?: boolean;
  progress?: BulkProgress | null;
  onCancel?: () => void;
}

// Mobile: the bar lives at one of two explicit anchors — above the
// filter bar (top of the 3-stack) when tab + filter are visible, or at
// the viewport bottom when they've auto-hidden on scroll-down. The
// anchor flips based on `useScrollDirection()`; `transition-[bottom]`
// glides between them. While selection is idle the bar isn't rendered
// on mobile at all (`hidden md:flex`) so it can't cover the filter bar.
//
// Desktop: bare flex group of icon-only ghost buttons inline inside
// the unified TopHeader's belowSlot. `md:static` overrides every
// mobile-anchor rule below. qui-style: small selection-count badge
// sits before the icon group.
const DESKTOP_INLINE =
  "md:static md:inset-auto md:items-center md:gap-1 md:bg-transparent md:p-0";
const MOBILE_BASE =
  "fixed inset-x-0 z-30 flex items-center gap-3 bg-muted/95 px-4 py-4 backdrop-blur-md";
const ANCHOR_ABOVE_FILTER =
  "bottom-[calc(var(--spacing-bottom-bar)+var(--spacing-mobile-filter-bar)+env(safe-area-inset-bottom))]";
const ANCHOR_VIEWPORT_BOTTOM = "bottom-[env(safe-area-inset-bottom)]";
const MOBILE_HIDDEN = "hidden md:flex";

// Mobile: large square tap targets (44pt-ish). Desktop: compact h-7 w-7
// icon-only ghost buttons matching the rest of the unified header.
const buttonSize = "h-10 w-10 md:h-7 md:w-7 md:p-0";
const iconSize = "h-5 w-5 md:h-4 md:w-4";

export function BulkActionToolbar({
  selectedCount,
  onSearch,
  onDelete,
  onIgnore,
  disabled,
  progress,
  onCancel,
}: Props) {
  const t = useTranslations("bulk");
  // Desktop bar stays visible always with disabled buttons (qui pattern,
  // no layout shift); the mobile fixed-bottom strip only mounts visually
  // when something is selected (or a bulk action is in progress), so it
  // can't cover the last rows while idle.
  const actionsDisabled = disabled || selectedCount === 0;
  const isMobileIdle = !progress && selectedCount === 0;
  // When the user scrolls down with a selection active, tab + filter
  // bars translate off-screen. The bulk bar stays pinned but moves to
  // the slot they left — that's the anchor swap below.
  const direction = useScrollDirection();
  const prefersReducedMotion = usePrefersReducedMotion();
  const mobileAnchor =
    direction === "down" ? ANCHOR_VIEWPORT_BOTTOM : ANCHOR_ABOVE_FILTER;
  const wrapperClasses = cn(
    DESKTOP_INLINE,
    isMobileIdle ? MOBILE_HIDDEN : [MOBILE_BASE, mobileAnchor],
    // Glide between the two anchors. Desktop is `md:static` so the
    // bottom transition is a no-op there.
    prefersReducedMotion ? "" : "transition-[bottom] duration-200 ease-out",
  );

  if (progress) {
    const pct =
      progress.total > 0
        ? Math.min(100, (progress.current / progress.total) * 100)
        : 0;
    return (
      <div className={wrapperClasses}>
        <div role="status" aria-live="polite" className="text-sm font-medium">
          {t(`progress.${progress.action}`, {
            current: progress.current,
            total: progress.total,
          })}
        </div>
        <div className="bg-muted-foreground/20 ml-auto h-1 w-24 overflow-hidden rounded-sm">
          <div
            className="bg-primary h-full rounded-sm transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {onCancel && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onCancel}
            aria-label={t("cancel")}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={wrapperClasses}>
      {/* Mobile: full "N selected" sentence reads naturally on a wide
          fixed-bottom bar. Desktop: compact count badge with min-width
          so single/double/triple-digit counts all align. */}
      <span className="text-base font-medium md:hidden">
        {t("selected", { count: selectedCount })}
      </span>
      <span
        className="text-muted-foreground hidden min-w-[3ch] text-center text-xs whitespace-nowrap tabular-nums md:inline"
        aria-label={t("selected", { count: selectedCount })}
      >
        {selectedCount}
      </span>
      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={onSearch}
          disabled={actionsDisabled}
          title={t("search")}
          aria-label={t("search")}
          className={buttonSize}
        >
          <Search className={iconSize} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onIgnore}
          disabled={actionsDisabled}
          title={t("ignore")}
          aria-label={t("ignore")}
          className={buttonSize}
        >
          <EyeOff className={iconSize} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(false)}
          disabled={actionsDisabled}
          title={t("delete")}
          aria-label={t("delete")}
          className={cn(buttonSize, "text-destructive hover:text-destructive")}
        >
          <Trash2 className={iconSize} />
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onDelete(true)}
          disabled={actionsDisabled}
          title={t("deleteAndSearch")}
          aria-label={t("deleteAndSearch")}
          className={buttonSize}
        >
          <Trash2 className={iconSize} />
        </Button>
      </div>
    </div>
  );
}
