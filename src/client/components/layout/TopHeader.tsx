"use client";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/client/components/ui/button";
import { HealthDot } from "./HealthDot";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  onToggleSidebar: () => void;
  // Per-page chrome rendered between the hamburger and the right group
  // (theme + health). Hidden on mobile so the bar stays minimal there.
  // The slot is `flex-nowrap` + `min-w-0`: at narrow widths children
  // shrink (search input) rather than wrap to a second visual row.
  slot?: ReactNode;
  // Content forced to its own row BELOW the main header row via
  // `basis-full`. Keeps the main row single-line so theme/health stays
  // optically aligned with the slot's controls (qui pattern — bulk
  // toolbar wraps to a sibling row instead of growing the slot).
  belowSlot?: ReactNode;
}

// TopHeader sits inside the right column of AppShell (sibling of main),
// not above the sidebar. The brand wordmark lives in the Sidebar's
// header on md+; this TopHeader carries only page chrome + the right-
// hand utilities. On mobile (no sidebar) we render a small Logo in the
// header so users still see the brand at the top of the page.
export function TopHeader({ onToggleSidebar, slot, belowSlot }: Props) {
  const tNav = useTranslations("nav");
  return (
    <header className="border-border bg-card flex min-h-14 flex-wrap content-center items-center gap-3 border-b px-3 py-1.5">
      {/*
        - `min-h-14` makes the header at least 56px tall.
        - Default `align-content: normal` glues the single content row
          to the TOP of that 56px (visible as theme/health appearing
          "shifted top" with empty space below). `content-center` flips
          that: the content row(s) center vertically in the 56px.
        - `items-center` keeps each row's items vertically aligned at
          their row's center. With theme group having natural height
          (no h-14 shim), this gives consistent icon eye-lines for
          hamburger, slot items, and theme/health.
        - `flex-wrap` lets the slot's content overflow gracefully to a
          second row at very narrow desktop widths; align-content:
          center keeps that grouped block centered too.
      */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onToggleSidebar}
        aria-label={tNav("openMenu")}
        className="hidden md:inline-flex"
      >
        <Menu className="size-5" />
      </Button>
      <Logo size="md" className="md:hidden" />
      {slot && (
        <div className="hidden min-w-0 flex-1 flex-nowrap items-center gap-2 md:flex">
          {slot}
        </div>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <ThemeToggle />
        <HealthDot />
      </span>
      {/*
        belowSlot wraps to its OWN row via `basis-full`. Keeping it
        outside the main slot is what lets the slot's content stay on a
        single flex line — so theme/health, instance picker, search bar
        and friends all share the same vertical center via the parent's
        `items-center`. Mirrors qui's bulk-management-bar pattern.
      */}
      {belowSlot && <div className="hidden basis-full md:block">{belowSlot}</div>}
    </header>
  );
}
