"use client";
import { memo, useEffect, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  flexRender,
  type Header,
  type HeaderGroup,
  type Table,
} from "@tanstack/react-table";
import { Checkbox } from "@/client/components/ui/checkbox";
import { cn } from "@/client/lib/utils";

const SCROLL_THRESHOLD_PX = 4;

// Watch scroll on the nearest ancestor scroller and report whether
// we've scrolled past `threshold` — drives the sticky header's
// backdrop-blur effect.
function useScrolledPast(
  containerRef: RefObject<HTMLElement | null>,
  threshold: number,
) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    let scroller: HTMLElement | Window = window;
    let parent: HTMLElement | null = node.parentElement;
    while (parent) {
      const overflow = window.getComputedStyle(parent).overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        scroller = parent;
        break;
      }
      parent = parent.parentElement;
    }
    const onScroll = () => {
      const top =
        scroller === window
          ? window.scrollY
          : (scroller as HTMLElement).scrollTop;
      setScrolled(top > threshold);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [containerRef, threshold]);
  return scrolled;
}

interface Props<T> {
  // The TanStack table instance — passed directly (instead of a derived
  // `headerGroups[]` array) so React.memo's shallow compare can short-
  // circuit on every parent re-render. `table.getHeaderGroups()` returns
  // a fresh array on each call, which would defeat memo if passed as a
  // prop; the table instance itself is stable across renders.
  table: Table<T>;
  // Ref to the table root — header observes its nearest scrollable
  // ancestor to drive the sticky-shadow transition when the sticky
  // header lifts off the page top.
  containerRef: RefObject<HTMLElement | null>;
  hasActions?: boolean;
  // Master "select all" checkbox state.
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  // Fixed widths for the leading select-all + trailing actions columns —
  // both live outside TanStack's column model.
  selectColumnPx: number;
  actionsColumnPx: number;
  // Double-click on a resize handle resets that column to its default
  // width by removing its entry from the persisted sizing state.
  onResetColumnSize: (columnId: string) => void;
}

interface HeaderRowProps<T> {
  group: HeaderGroup<T>;
  hasActions?: boolean;
  selectColumnPx: number;
  actionsColumnPx: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onResetColumnSize: (columnId: string) => void;
  selectAllLabel: string;
}

interface HeaderCellProps<T> {
  header: Header<T, unknown>;
  isLastDataCol: boolean;
  onResetColumnSize: (columnId: string) => void;
}

interface HeaderLabelProps<T> {
  header: Header<T, unknown>;
}

function getAriaSort(
  canSort: boolean,
  sortDir: false | "asc" | "desc",
): "ascending" | "descending" | "none" | undefined {
  if (!canSort) return undefined;
  if (sortDir === "asc") return "ascending";
  if (sortDir === "desc") return "descending";
  return "none";
}

function HeaderLabel<T>({ header }: HeaderLabelProps<T>) {
  if (header.isPlaceholder) return null;
  return flexRender(header.column.columnDef.header, header.getContext());
}

function SortableHeaderLabel<T>({ header }: HeaderLabelProps<T>) {
  const sortDir = header.column.getIsSorted();
  const isActiveSort = sortDir !== false;
  const SortIcon = sortDir === "asc" ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      className="hover:text-foreground inline-flex min-w-0 cursor-pointer items-center gap-1 select-none"
      onClick={header.column.getToggleSortingHandler()}
    >
      <span className="truncate">
        <HeaderLabel header={header} />
      </span>
      <SortIcon
        className={cn(
          "text-foreground size-3.5 shrink-0 transition-opacity",
          isActiveSort ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />
    </button>
  );
}

function ResizeHandle<T>({
  header,
  onResetColumnSize,
}: Pick<HeaderCellProps<T>, "header" | "onResetColumnSize">) {
  const column = header.column;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${column.id} column`}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onDoubleClick={() => onResetColumnSize(column.id)}
      className="group/resize absolute top-0 right-0 flex h-full w-2 cursor-col-resize touch-none justify-end select-none"
    >
      <div
        className={cn(
          "h-full w-px",
          column.getIsResizing()
            ? "bg-brand"
            : "group-hover/resize:bg-brand/50 bg-transparent",
        )}
      />
    </div>
  );
}

function HeaderCell<T>({
  header,
  isLastDataCol,
  onResetColumnSize,
}: HeaderCellProps<T>) {
  const column = header.column;
  const meta = column.columnDef.meta;
  const canSort = column.getCanSort();
  const canResize = column.getCanResize();

  return (
    <div
      key={header.id}
      role="columnheader"
      aria-sort={getAriaSort(canSort, column.getIsSorted())}
      className={cn(
        "group/col relative flex shrink-0 items-center justify-between gap-1 px-3 py-2.5 font-medium",
        !isLastDataCol && "border-border/60 border-r",
        meta?.grow && "grow",
        meta?.className,
      )}
      style={{ width: header.getSize() }}
    >
      {canSort ? (
        <SortableHeaderLabel header={header} />
      ) : (
        <span className="inline-flex min-w-0 items-center truncate">
          <HeaderLabel header={header} />
        </span>
      )}
      {meta?.filter && <span className="ml-auto shrink-0">{meta.filter}</span>}
      {canResize && (
        <ResizeHandle header={header} onResetColumnSize={onResetColumnSize} />
      )}
    </div>
  );
}

function HeaderRow<T>({
  group,
  hasActions,
  selectColumnPx,
  actionsColumnPx,
  allSelected,
  someSelected,
  onToggleAll,
  onResetColumnSize,
  selectAllLabel,
}: HeaderRowProps<T>) {
  const lastDataColIndex = group.headers.length - 1;

  return (
    <div
      key={group.id}
      role="row"
      className="text-muted-foreground flex items-center text-left text-xs tracking-wide uppercase"
    >
      <div
        role="columnheader"
        className="border-border/60 flex shrink-0 items-center border-r px-3 py-2.5"
        style={{ width: selectColumnPx }}
      >
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onCheckedChange={onToggleAll}
          aria-label={selectAllLabel}
        />
      </div>
      {group.headers.map((header, idx) => (
        <HeaderCell
          key={header.id}
          header={header}
          isLastDataCol={idx === lastDataColIndex && !hasActions}
          onResetColumnSize={onResetColumnSize}
        />
      ))}
      {hasActions && (
        <div
          role="columnheader"
          aria-hidden
          className="shrink-0"
          style={{ width: actionsColumnPx }}
        />
      )}
    </div>
  );
}

function MediaTableHeaderImpl<T>({
  table,
  containerRef,
  hasActions,
  allSelected,
  someSelected,
  onToggleAll,
  selectColumnPx,
  actionsColumnPx,
  onResetColumnSize,
}: Props<T>) {
  const scrolled = useScrolledPast(containerRef, SCROLL_THRESHOLD_PX);
  const tBulk = useTranslations("bulk");
  // Derive header groups from the stable table instance — recomputed on
  // each render but only when this component renders, which is rare
  // (memo'd: only when props actually change).
  const headerGroups = table.getHeaderGroups();

  return (
    <div
      role="rowgroup"
      // Solid bg always. We previously swapped to bg-background/80 +
      // backdrop-blur when scrolled for a "frosted" look, but
      // backdrop-filter re-evaluates every frame the wrapper scrolls
      // — on a flick-scroll it dropped frames and the page bg showed
      // through as a black flash. Solid bg is repaint-cheap and looks
      // virtually identical at this density.
      className={cn(
        "bg-background sticky top-0 z-10 border-b",
        scrolled && "shadow-sm",
      )}
    >
      {headerGroups.map((group) => (
        <HeaderRow
          key={group.id}
          group={group}
          hasActions={hasActions}
          selectColumnPx={selectColumnPx}
          actionsColumnPx={actionsColumnPx}
          allSelected={allSelected}
          someSelected={someSelected}
          onToggleAll={onToggleAll}
          onResetColumnSize={onResetColumnSize}
          selectAllLabel={tBulk("selectAll")}
        />
      ))}
    </div>
  );
}

// memo: the header re-rendered on every parent commit during virt
// scroll (86×/flick at ~7.7ms each → ~660ms wasted) even though none
// of its props had changed — Profiler's "Why did this render?" tag
// confirmed: "The parent component rendered". Default shallow compare
// is sufficient because every prop is stable: `table` is the
// TanStack instance (stable across renders), `containerRef` is a
// React ref, primitives don't change, and the two callbacks come from
// useCallback-wrapped hooks.
export const MediaTableHeader = memo(
  MediaTableHeaderImpl,
) as typeof MediaTableHeaderImpl;
