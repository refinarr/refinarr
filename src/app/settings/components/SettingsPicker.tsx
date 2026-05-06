"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { cn } from "@/client/lib/utils";
import type { SettingsRailItem } from "./SettingsRail";

interface Props {
  items: SettingsRailItem[];
  active: string;
  onSelect: (id: string) => void;
  className?: string;
}

// Mobile counterpart to SettingsRail. Renders the active section's
// label + icon in the trigger (Base UI's <SelectValue /> defaults to
// the raw value). Sticky positioning is handled by the parent so the
// page can group the picker with the page title in one sticky bar.
export function SettingsPicker({ items, active, onSelect, className }: Props) {
  const activeItem = items.find((i) => i.id === active);
  const ActiveIcon = activeItem?.icon;

  return (
    <Select
      value={active}
      onValueChange={(v) => {
        if (v) onSelect(v);
      }}
    >
      <SelectTrigger
        className={cn(
          "h-control-lg w-full text-base [&>svg]:size-5",
          className,
        )}
      >
        <SelectValue>
          <span className="flex items-center gap-2.5">
            {ActiveIcon ? <ActiveIcon className="size-5" /> : null}
            <span className="font-medium">{activeItem?.label ?? ""}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map(({ id, label, icon: Icon }) => (
          <SelectItem key={id} value={id} className="h-control text-base">
            <span className="flex items-center gap-2.5">
              <Icon className="size-5" />
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
