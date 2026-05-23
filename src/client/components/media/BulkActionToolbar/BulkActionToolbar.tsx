"use client";
import { useEffect, useReducer } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Search, Trash2, EyeOff, X, MoreHorizontal } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { usePrefersReducedMotion } from "@/client/hooks/ui/useMediaQuery";
import { cn } from "@/client/lib/utils";
import type { BulkProgress } from "./types";

interface Props {
  selectedCount: number;
  onSearch: () => void;
  onDelete: () => void;
  onIgnore: () => void;
  // Clears the row selection. Fired by the × button AND the ESC key
  // listener that's only attached while the bar is open.
  onClearSelection: () => void;
  disabled?: boolean;
  progress?: BulkProgress | null;
  onCancel?: () => void;
}

// 4-state machine so the bar can animate in/out without unmounting
// mid-transition. `opening` flips to `open` on the next frame so the CSS
// transition picks up the state change; `closing` waits for the exit
// duration before unmounting → null layout footprint while closed.
type BarState = "closed" | "opening" | "open" | "closing";

type BarEvent = "show" | "hide" | "settle-open" | "settle-closed";

// Pure transition fn — keeps the state machine readable and lets the
// effects below dispatch events without re-deriving state inline.
function reduce(state: BarState, event: BarEvent): BarState {
  switch (event) {
    case "show":
      return state === "closed" || state === "closing" ? "opening" : state;
    case "hide":
      return state === "open" || state === "opening" ? "closing" : state;
    case "settle-open":
      return state === "opening" ? "open" : state;
    case "settle-closed":
      return state === "closing" ? "closed" : state;
  }
}

// Match the CSS transition duration below. Kept short so the bar feels
// responsive on dismiss — long exits make ESC feel laggy.
const EXIT_MS = 150;

// `<html data-bulk-bar="open">` is set whenever the bar is visible (in
// any of the animated states). MobileTabBar reads it via an ancestor
// variant to slide itself off-screen — selection mode replaces the nav
// rather than stacking two bottom UIs. Other consumers can hook into
// the same attribute the same way.
const BULK_BAR_DATA_ATTR = "bulkBar";
const BULK_BAR_DATA_VALUE = "open";

export function BulkActionToolbar({
  selectedCount,
  onSearch,
  onDelete,
  onIgnore,
  onClearSelection,
  disabled,
  progress,
  onCancel,
}: Props) {
  const t = useTranslations("bulk");
  const prefersReducedMotion = usePrefersReducedMotion();

  // The bar is "live" when the user has a selection OR a bulk action is
  // still running (so the final progress tick is visible after they've
  // cleared via batch-complete).
  const shouldShow = selectedCount > 0 || progress != null;

  const [state, dispatch] = useReducer(reduce, "closed");

  // Drive the state machine off `shouldShow`. The reducer is pure, so
  // dispatching from inside an effect is safe — no cascading-render
  // smell that bare setState would have.
  //   closed → opening (next frame) → open
  //   open   → closing (EXIT_MS)    → closed (unmount)
  useEffect(() => {
    dispatch(shouldShow ? "show" : "hide");
  }, [shouldShow]);

  // `opening` → `open` on the next frame so the browser applies the
  // hidden styles first, then transitions to the visible state. Without
  // the frame gap the transition wouldn't run.
  useEffect(() => {
    if (state !== "opening") return;
    const id = window.requestAnimationFrame(() => dispatch("settle-open"));
    return () => window.cancelAnimationFrame(id);
  }, [state]);

  // `closing` → `closed` after the exit animation. Reduced-motion users
  // skip the wait so the unmount is immediate.
  useEffect(() => {
    if (state !== "closing") return;
    if (prefersReducedMotion) {
      dispatch("settle-closed");
      return;
    }
    const id = window.setTimeout(() => dispatch("settle-closed"), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [state, prefersReducedMotion]);

  // ESC dismisses while the bar is visible. Listener is scoped to the
  // visible window so we don't intercept ESC for other components when
  // the bar is closed (drawer, dialog, command palette all use ESC too).
  useEffect(() => {
    if (state === "closed") return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClearSelection();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [state, onClearSelection]);

  // Toggle a `data-bulk-bar="open"` attribute on <html> whenever the
  // bar is visible (any state except `closed`). MobileTabBar's class
  // includes an ancestor variant that slides it off-screen while this
  // attribute is set, so the mobile nav cleanly gives way during a
  // selection. Cleanup removes the attribute on unmount and between
  // transitions; the next body re-applies it synchronously when needed.
  useEffect(() => {
    const root = document.documentElement;
    if (state === "closed") {
      delete root.dataset[BULK_BAR_DATA_ATTR];
    } else {
      root.dataset[BULK_BAR_DATA_ATTR] = BULK_BAR_DATA_VALUE;
    }
    return () => {
      delete root.dataset[BULK_BAR_DATA_ATTR];
    };
  }, [state]);

  // SSR guard first — the `state === "closed"` guard below covers the
  // initial client render but a future change (e.g. an initial open
  // state for hydration) would silently break this defence-in-depth
  // unless the document check runs unconditionally.
  if (typeof document === "undefined") return null;
  if (state === "closed") return null;

  const actionsDisabled = disabled || selectedCount === 0;

  const bar = (
    <div
      data-state={state}
      role="region"
      aria-label={t("selected", { count: Math.max(selectedCount, 0) })}
      className={cn(
        // Fixed, centered, max-capped width so the bar floats above the
        // home indicator on iOS and clears the mobile tab bar by sitting
        // above it. The viewport gutter (calc(100vw - 1rem)) keeps a
        // 0.5rem margin on each side at narrow widths.
        "fixed left-1/2 z-50 -translate-x-1/2",
        "bottom-[max(env(safe-area-inset-bottom),0.75rem)]",
        "w-max max-w-[min(calc(100vw-1rem),760px)]",
        "ring-foreground/10 rounded-full shadow-lg ring-1",
        // Dark pill regardless of theme — high contrast against any
        // table background and matches the "command bar" affordance.
        "bg-neutral-900 text-neutral-50 dark:bg-neutral-950",
        "flex items-center gap-2 px-3 py-2",
        // Animated transform + opacity gated by data-state. The base
        // class sets the "open" target; opening/closing override with
        // the hidden offsets. motion-reduce skips the transition.
        "motion-safe:transition-[transform,opacity] motion-safe:duration-150 motion-safe:ease-out",
        "translate-y-0 opacity-100",
        "data-[state=opening]:translate-y-3 data-[state=opening]:opacity-0",
        "data-[state=closing]:translate-y-3 data-[state=closing]:opacity-0",
      )}
    >
      {progress ? (
        <ProgressView progress={progress} onCancel={onCancel} t={t} />
      ) : (
        <ActionsView
          selectedCount={selectedCount}
          onClearSelection={onClearSelection}
          onSearch={onSearch}
          onIgnore={onIgnore}
          onDelete={onDelete}
          disabled={actionsDisabled}
          t={t}
        />
      )}
    </div>
  );

  return createPortal(bar, document.body);
}

interface ActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onSearch: () => void;
  onIgnore: () => void;
  onDelete: () => void;
  disabled: boolean;
  t: ReturnType<typeof useTranslations>;
}

function ActionsView({
  selectedCount,
  onClearSelection,
  onSearch,
  onIgnore,
  onDelete,
  disabled,
  t,
}: ActionsProps) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClearSelection}
        aria-label={t("clearSelection")}
        className="text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50"
      >
        <X />
      </Button>
      <span
        className="px-1 text-sm font-medium tabular-nums"
        aria-live="polite"
      >
        {t("selected", { count: selectedCount })}
      </span>
      <div className="mx-1 h-5 w-px bg-neutral-700" aria-hidden />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="default"
          onClick={onSearch}
          disabled={disabled}
          aria-label={t("search")}
          className="text-neutral-100 hover:bg-neutral-800 hover:text-neutral-50"
        >
          <Search />
          <span className="hidden sm:inline">{t("search")}</span>
        </Button>
        <Button
          variant="ghost"
          size="default"
          onClick={onIgnore}
          disabled={disabled}
          aria-label={t("ignore")}
          className="text-neutral-100 hover:bg-neutral-800 hover:text-neutral-50"
        >
          <EyeOff />
          <span className="hidden sm:inline">{t("ignore")}</span>
        </Button>
        <Button
          variant="ghost"
          size="default"
          onClick={onDelete}
          disabled={disabled}
          aria-label={t("delete")}
          className="text-destructive hover:bg-destructive/20 hover:text-destructive"
        >
          <Trash2 />
          <span className="hidden sm:inline">{t("delete")}</span>
        </Button>
      </div>
      {/*
        Overflow trigger — placeholder for v2. The menu exists so the
        affordance is in the design and the keyboard tab order is final,
        but ships with a single disabled item so we don't fake a feature.
      */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50"
            />
          }
          aria-label={t("moreActions")}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem disabled>{t("moreActions")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

interface ProgressProps {
  progress: BulkProgress;
  onCancel?: () => void;
  t: ReturnType<typeof useTranslations>;
}

function ProgressView({ progress, onCancel, t }: ProgressProps) {
  const pct =
    progress.total > 0
      ? Math.min(100, (progress.current / progress.total) * 100)
      : 0;
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="px-2 text-sm font-medium"
      >
        {t(`progress.${progress.action}`, {
          current: progress.current,
          total: progress.total,
        })}
      </div>
      <div className="h-1 w-32 overflow-hidden rounded-sm bg-neutral-700">
        <div
          className="h-full rounded-sm bg-neutral-50 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {onCancel && (
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onCancel}
          aria-label={t("cancel")}
          className="text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50"
        >
          <X />
        </Button>
      )}
    </>
  );
}
