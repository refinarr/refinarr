"use client";
import { Badge } from "@/client/components/ui/badge";
import { Search, Trash2, EyeOff, Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const meta: Record<string, { label: string; icon: LucideIcon; classes: string }> = {
  search: { label: "Search", icon: Search, classes: "bg-sky-950 text-sky-300 border-sky-800" },
  delete: { label: "Delete", icon: Trash2, classes: "bg-orange-950 text-orange-300 border-orange-800" },
  delete_blacklist: { label: "Delete", icon: Trash2, classes: "bg-orange-950 text-orange-300 border-orange-800" },
  ignore: { label: "Ignore", icon: EyeOff, classes: "bg-slate-700/40 text-slate-300 border-slate-600" },
};

const fallback = {
  icon: Activity,
  classes: "bg-slate-700/40 text-slate-300 border-slate-600",
};

interface Props {
  action: string;
}

export function ActionTypeBadge({ action }: Props) {
  const entry = meta[action];
  const label = entry?.label ?? action.replace(/_/g, " ");
  const Icon = entry?.icon ?? fallback.icon;
  const classes = entry?.classes ?? fallback.classes;
  return (
    <Badge variant="outline" className={`gap-1 capitalize ${classes}`}>
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}
