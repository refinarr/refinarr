"use client";
import { Filter as FilterIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/client/components/ui/popover";
import { cn } from "@/client/lib/utils";

interface Props {
  // Drives the trigger's active styling (brand-tinted icon + dot) so
  // the column header signals "this column is being filtered" at a
  // glance, even when the popover is closed.
  active: boolean;
  // Headline shown at the top of the popover, e.g. "Filter Custom
  // Formats". Always render — no anchor description needed.
  title: string;
  // Optional sub-headline under the title. One short sentence.
  description?: string;
  // Trigger button accessible name — needed because the visible label
  // is icon-only.
  triggerAriaLabel: string;
  // Optional clear handler — when provided AND `active`, a Clear
  // affordance shows at the bottom of the popover. `clearLabel` is
  // required (not nullable) so callers always supply an i18n'd string;
  // no English fallback lives in the primitive.
  onClear?: () => void;
  clearLabel: string;
  // Body of the popover (the actual filter controls).
  children: ReactNode;
  contentClassName?: string;
}

// Funnel-icon trigger inside a table column header that opens a
// Popover with consumer-defined filter controls. Mirrors the
// Excel / Airtable / qui pattern. Active state surfaces as a
// brand-tinted icon + a small dot in the corner.
export function ColumnFilter({
  active,
  title,
  description,
  triggerAriaLabel,
  onClear,
  clearLabel,
  children,
  contentClassName,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={triggerAriaLabel}
        className={cn(
          "focus-visible:ring-ring relative ml-1 inline-flex size-5 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none",
          active
            ? "text-brand"
            : "text-muted-foreground/60 hover:text-foreground",
        )}
      >
        <FilterIcon className="size-3.5" />
        {active && (
          <span
            aria-hidden
            className="bg-brand absolute -top-0.5 -right-0.5 size-1.5 rounded-full"
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-72 max-w-[calc(100vw-1rem)] space-y-3",
          contentClassName,
        )}
      >
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-xs">{description}</p>
          )}
        </div>
        {children}
        {active && onClear && (
          <div className="border-border/60 flex justify-end border-t pt-2">
            <button
              type="button"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              {clearLabel}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
