"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, EyeOff, Search } from "lucide-react";
import { Checkbox } from "@/client/components/ui/checkbox";
import { cn } from "@/client/lib/utils";
import {
  useIsMobile,
  usePrefersReducedMotion,
} from "@/client/hooks/ui/useMediaQuery";
import { useSwipeReveal } from "@/client/hooks/ui/useSwipeReveal";

// Raw handlers for the mobile swipe-to-reveal panel. Reuses the same
// callbacks the desktop RowHoverActions fires (ctx.runSearch / runIgnore)
// — no new mutation paths.
export interface SwipeActions {
  onSearch: () => void;
  onIgnore: () => void;
}

interface Props<T extends { id: number }> {
  row: T;
  selected: boolean;
  onToggleSelect: () => void;
  onRowClick: () => void;
  renderCard: (row: T) => ReactNode;
  actions?: ReactNode;
  // When provided (and on a phone, not in selection mode), swiping the
  // card left reveals Search/Ignore instead of the inline hover actions.
  swipeActions?: SwipeActions;
  // True when bulk-selection is active anywhere in the list — disables
  // swipe so the gesture doesn't fight checkbox taps / the bulk bar.
  selectionActive?: boolean;
  // True when this card is the deep-link target. Drives the focus
  // animation directly on the card's rounded root so the highlight
  // follows the card's border-radius.
  focused?: boolean;
}

// Two 64px action buttons behind the card.
const REVEAL_PX = 128;

export function MediaCard<T extends { id: number }>({
  row,
  selected,
  onToggleSelect,
  onRowClick,
  renderCard,
  actions,
  swipeActions,
  selectionActive,
  focused,
}: Props<T>) {
  const t = useTranslations("common");
  const isMobile = useIsMobile();
  const reduceMotion = usePrefersReducedMotion();

  // A phone card whose actions come from swipe (not the inline icons).
  // The inline icons are gated on this — NOT on swipeEnabled — so they
  // never pop in when selection turns the gesture off (that flip was a
  // layout shift). swipeEnabled gates the live gesture: phone-only, has
  // handlers, and yields while selecting (bulk bar owns actions then).
  const swipeCapable = isMobile && !!swipeActions;
  const swipeEnabled = swipeCapable && !selectionActive;
  const { offset, isOpen, isDragging, close, wasDragRef, surfaceProps } =
    useSwipeReveal({ enabled: swipeEnabled, revealWidth: REVEAL_PX });

  const handleContentClick = () => {
    // A horizontal drag just snapped — swallow the synthetic click so a
    // swipe doesn't also open the drawer.
    if (wasDragRef.current) {
      wasDragRef.current = false;
      return;
    }
    if (isOpen) {
      close();
      return;
    }
    onRowClick();
  };

  const runAction = (fn: () => void) => {
    fn();
    close();
  };

  // Only drive transform/transition when swipe is live; otherwise leave
  // the content untransformed so the desktop `transition-colors` hover
  // (from className) isn't overridden by an inline `transition`.
  const contentStyle = swipeEnabled
    ? {
        transform: `translateX(-${offset}px)`,
        transition:
          isDragging || reduceMotion
            ? "none"
            : "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        touchAction: "pan-y" as const,
      }
    : undefined;

  return (
    <li
      className={cn(
        "bg-card relative rounded-lg border",
        // Clip the left overflow + the action panel on phone swipe-cards;
        // on desktop keep overflow visible so the focus glow isn't clipped.
        // Gated on swipeCapable (stable) so selection doesn't toggle it.
        swipeCapable && "overflow-hidden",
        focused && "media-row-focused",
      )}
    >
      {swipeEnabled && (
        // row-reverse → Search (info) lands on the right for easy thumb
        // reach and peeks first; Ignore (critical) sits deeper.
        <div
          className="absolute inset-y-0 right-0 flex flex-row-reverse"
          style={{ width: REVEAL_PX }}
          aria-hidden={!isOpen}
        >
          <button
            type="button"
            tabIndex={isOpen ? 0 : -1}
            aria-label={t("search")}
            onClick={() => runAction(swipeActions!.onSearch)}
            className="bg-info text-info-foreground flex w-16 flex-col items-center justify-center gap-1 text-xs font-medium"
          >
            <Search className="size-5" aria-hidden />
            {t("search")}
          </button>
          <button
            type="button"
            tabIndex={isOpen ? 0 : -1}
            aria-label={t("ignore")}
            onClick={() => runAction(swipeActions!.onIgnore)}
            className="bg-critical text-critical-foreground flex w-16 flex-col items-center justify-center gap-1 text-xs font-medium"
          >
            <EyeOff className="size-5" aria-hidden />
            {t("ignore")}
          </button>
        </div>
      )}

      {/* Sliding surface: checkbox · content (flex-1) · actions + chevron. */}
      <div
        data-testid="media-card-surface"
        className="group bg-card hover:bg-muted/40 flex cursor-pointer items-start gap-3 p-3 transition-colors"
        style={contentStyle}
        onClick={handleContentClick}
        {...surfaceProps}
      >
        <span
          className="pt-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
        >
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
        </span>
        <div className="min-w-0 flex-1">{renderCard(row)}</div>
        <div className="flex shrink-0 items-center gap-0.5 self-center">
          {/* Swipe replaces the inline actions on phone swipe-cards (even
              during selection — the bulk bar owns actions then), so they
              never pop in and shift layout. Kept for desktop hover +
              tablet pointer-coarse. */}
          {!swipeCapable && actions && (
            <span
              className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              {actions}
            </span>
          )}
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </div>
      </div>
    </li>
  );
}
