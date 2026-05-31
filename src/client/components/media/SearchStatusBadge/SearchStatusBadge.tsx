"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Hourglass, Check } from "lucide-react";
import { Badge } from "@/client/components/ui/badge";
import { cn } from "@/client/lib/utils";

type Status = "pending" | "searched";

type Props =
  | { status: "pending"; instanceId: number; title?: string }
  | {
      status: "searched";
      instanceId: number;
      title?: string;
      relativeTime: string;
    };

const classes: Record<Status, string> = {
  pending: "bg-warning-soft text-warning border-warning/30 hover:bg-warning/20",
  searched:
    "bg-neutral-soft text-neutral-foreground border-border hover:bg-muted",
};

export function SearchStatusBadge(props: Props) {
  const t = useTranslations("search");
  const { status, instanceId, title } = props;
  const titleSuffix = title ? `&q=${encodeURIComponent(title)}` : "";
  const href =
    status === "pending"
      ? `/queue?instanceId=${instanceId}`
      : `/history?instanceId=${instanceId}${titleSuffix}`;
  const Icon = status === "pending" ? Hourglass : Check;
  const label =
    status === "pending"
      ? t("pendingBadge")
      : t("searchedBadge", { time: props.relativeTime });
  const tooltip =
    status === "pending"
      ? t("pendingBadgeTooltip")
      : t("searchedBadgeTooltip", { time: props.relativeTime });

  return (
    <Link
      href={href}
      title={tooltip}
      aria-label={tooltip}
      // Keep the badge visually compact but give the link a ≥44px tap target on
      // touch devices (Apple HIG) without enlarging it on desktop (#29).
      className="inline-flex items-center pointer-coarse:min-h-11"
    >
      <Badge variant="outline" className={cn("gap-1 text-xs", classes[status])}>
        <Icon className="size-3" />
        {label}
      </Badge>
    </Link>
  );
}
