"use client";
import { usePathname, useRouter } from "next/navigation";
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
  className?: string;
}

// Mobile counterpart to SettingsRail. Each rail item is a route, so
// the picker reads the current section from the URL via usePathname()
// and navigates with router.push() on change — no parent-owned active
// state, no onSelect callback. Renders the active item's label + icon
// in the trigger (Base UI's <SelectValue /> shows the raw value
// otherwise).
export function SettingsPicker({ items, className }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem =
    items.find(
      (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
    ) ?? items[0];
  const ActiveIcon = activeItem?.icon;

  return (
    <Select
      value={activeItem?.href ?? ""}
      onValueChange={(v) => {
        if (v) router.push(v);
      }}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue>
          <span className="flex items-center gap-2">
            {ActiveIcon ? <ActiveIcon className="size-4" /> : null}
            <span className="font-medium">{activeItem?.label ?? ""}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map(({ id, label, icon: Icon, href }) => (
          <SelectItem key={id} value={href}>
            <span className="flex items-center gap-2">
              <Icon className="size-4" />
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
