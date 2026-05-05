"use client";
import { useTranslations } from "next-intl";
import { Badge } from "@/client/components/ui/badge";
import { Search, Trash2, EyeOff, Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type KnownAction = "search" | "search_season" | "search_episode" | "delete" | "ignore";

const SEARCH_CLASSES = "bg-sky-950 text-sky-300 border-sky-800";
const DELETE_CLASSES = "bg-orange-950 text-orange-300 border-orange-800";

const meta: Record<string, { labelKey: KnownAction; icon: LucideIcon; classes: string }> = {
  search: { labelKey: "search", icon: Search, classes: SEARCH_CLASSES },
  search_season: { labelKey: "search_season", icon: Search, classes: SEARCH_CLASSES },
  search_episode: { labelKey: "search_episode", icon: Search, classes: SEARCH_CLASSES },
  delete: { labelKey: "delete", icon: Trash2, classes: DELETE_CLASSES },
  delete_blacklist: { labelKey: "delete", icon: Trash2, classes: DELETE_CLASSES },
  ignore: { labelKey: "ignore", icon: EyeOff, classes: "bg-slate-700/40 text-slate-300 border-slate-600" },
};

const fallback = {
  icon: Activity,
  classes: "bg-slate-700/40 text-slate-300 border-slate-600",
};

interface Props {
  action: string;
}

export function ActionTypeBadge({ action }: Props) {
  const t = useTranslations("history.actionLabels");
  const entry = meta[action];
  const label = entry ? t(entry.labelKey) : action.replace(/_/g, " ");
  const Icon = entry?.icon ?? fallback.icon;
  const classes = entry?.classes ?? fallback.classes;
  return (
    <Badge variant="outline" className={`gap-1 capitalize ${classes}`}>
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}
