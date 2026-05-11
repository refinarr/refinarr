"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { InstanceConnectionDot } from "@/client/components/common/InstanceConnectionDot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { cn } from "@/client/lib/utils";
import type { PublicInstance } from "@/shared/types/api";

interface Props {
  instances: PublicInstance[];
  activeId: number;
  onChange: (id: number) => void;
  // Optional small text shown beneath the instance name (e.g. count
  // summary like "200 Flagged / 1000"). Pass undefined to render a
  // single-line picker.
  subtitle?: ReactNode;
}

// Two-line instance switcher. Visual style mirrors qui's `Main qBit ⌄`:
// a bold instance name on top, small muted subtitle underneath, chevron
// to the right when there's more than one instance to pick from.
//
// Built on DropdownMenu (not Select) because this is navigation chrome,
// not a form value — DropdownMenu lets us style the trigger as bare
// text + chevron without inheriting Select's form-control sizing.
//
// Behaviour:
//   • 0 instances or no match → renders nothing.
//   • Exactly 1 instance → renders the name + subtitle as plain text
//     (no chevron, no menu — there's nothing to switch to).
//   • 2+ instances → wraps the same two-line trigger in a
//     DropdownMenuTrigger; the menu lists every instance name and
//     marks the active one.
export function InstancePicker({
  instances,
  activeId,
  onChange,
  subtitle,
}: Props) {
  const t = useTranslations("instanceSelector");
  const active = instances.find((i) => i.id === activeId);
  if (!active) return null;

  const triggerLabel = (
    <div className="flex flex-col items-start text-left leading-tight">
      <span className="text-base font-bold whitespace-nowrap">
        {active.name}
      </span>
      {subtitle && (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {subtitle}
        </span>
      )}
    </div>
  );

  if (instances.length <= 1) {
    return (
      <div data-testid="instance-switcher" className="shrink-0 px-2 py-0.5">
        {triggerLabel}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="instance-switcher"
        aria-label={t("instanceLabel")}
        className="hover:bg-accent/50 focus-visible:ring-ring/50 inline-flex shrink-0 items-center gap-2 rounded-md px-2 py-0.5 transition-colors outline-none focus-visible:ring-3"
      >
        {triggerLabel}
        <ChevronDown
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        // Wider than the trigger so URLs fit, capped so very long URLs
        // truncate instead of pushing the menu past the viewport.
        // `flex flex-col gap-1` is what actually creates the vertical
        // breathing room between items — the underlying base-ui Popup
        // is a plain block container by default, so plain `gap-1`
        // wouldn't apply without switching to flex.
        className="flex max-w-sm min-w-72 flex-col gap-1 p-1.5"
      >
        {instances.map((i) => (
          <DropdownMenuItem
            key={i.id}
            onClick={() => onChange(i.id)}
            // items-center vertically aligns the health dot with the
            // middle of the two-line label. py-2 + gap-3 give the row
            // breathing room. Active item is brand-tinted.
            className={cn(
              "items-center gap-3 p-2",
              i.id === activeId && "bg-accent",
            )}
          >
            <InstanceConnectionDot instanceId={i.id} />
            <div className="flex min-w-0 flex-col items-start gap-0.5 leading-tight">
              <span className="truncate text-sm font-medium">{i.name}</span>
              <span className="text-muted-foreground/70 truncate text-[11px]">
                {i.url}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
