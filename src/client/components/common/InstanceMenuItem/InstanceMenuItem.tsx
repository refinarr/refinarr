"use client";
import { InstanceConnectionDot } from "@/client/components/common/InstanceConnectionDot/InstanceConnectionDot";
import { DropdownMenuItem } from "@/client/components/ui/dropdown-menu";
import { cn } from "@/client/lib/utils";
import type { PublicInstance } from "@/shared/types/api";

interface Props {
  instance: PublicInstance;
  active: boolean;
  onSelect: (id: number) => void;
}

// One row in an instance-picker dropdown: connection dot + name + URL.
// Shared between the desktop InstancePicker (top header) and the
// mobile MobileInstanceTab (bottom bar) so the menu layout stays
// in lockstep.
export function InstanceMenuItem({ instance, active, onSelect }: Props) {
  return (
    <DropdownMenuItem
      onClick={() => onSelect(instance.id)}
      className={cn("items-center gap-3 p-2", active && "bg-accent")}
    >
      <InstanceConnectionDot instanceId={instance.id} />
      <div className="flex min-w-0 flex-col items-start gap-0.5 leading-tight">
        <span className="truncate text-sm font-medium">{instance.name}</span>
        <span className="text-muted-foreground/70 truncate text-[11px]">
          {instance.url}
        </span>
      </div>
    </DropdownMenuItem>
  );
}
