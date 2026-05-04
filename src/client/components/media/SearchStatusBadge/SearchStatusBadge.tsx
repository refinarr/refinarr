"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Hourglass, Check } from "lucide-react";
import { Badge } from "@/client/components/ui/badge";
import { cn } from "@/client/lib/utils";

type Status = "pending" | "searched";

type Props =
  | { status: "pending"; instanceId: number; title?: string }
  | { status: "searched"; instanceId: number; title?: string; relativeTime: string };

const classes: Record<Status, string> = {
  pending: "bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-950/60",
  searched: "bg-slate-700/40 text-slate-300 border-slate-600 hover:bg-slate-700/60",
};

export function SearchStatusBadge(props: Props) {
  const t = useTranslations("search");
  const { status, instanceId, title } = props;
  const titleSuffix = title ? `&q=${encodeURIComponent(title)}` : "";
  const href = status === "pending"
    ? `/queue?instanceId=${instanceId}`
    : `/history?instanceId=${instanceId}${titleSuffix}`;
  const Icon = status === "pending" ? Hourglass : Check;
  const label = status === "pending"
    ? t("pendingBadge")
    : t("searchedBadge", { time: props.relativeTime });
  const tooltip = status === "pending"
    ? t("pendingBadgeTooltip")
    : t("searchedBadgeTooltip", { time: props.relativeTime });

  return (
    <Link href={href} title={tooltip} aria-label={tooltip}>
      <Badge variant="outline" className={cn("gap-1 text-xs", classes[status])}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    </Link>
  );
}
