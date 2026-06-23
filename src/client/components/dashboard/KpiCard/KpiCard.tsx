"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Skeleton } from "@/client/components/ui/skeleton";
import { KpiCardSkeleton } from "@/client/components/states/KpiCardSkeleton";

type Tone = "default" | "warning" | "destructive";

interface Props {
  label: string;
  value: ReactNode;
  href?: string;
  tone?: Tone;
  // True during the initial dashboard fetch — render the whole-card
  // skeleton (label + value placeholders).
  loading?: boolean;
  // True once the summary has loaded but this card's value is still
  // resolving (e.g. a per-type total is null because at least one
  // instance is cold). Keeps the label + chrome and only swaps the
  // numeric value for a Skeleton.
  valueLoading?: boolean;
}

const toneClasses: Record<Tone, string> = {
  default: "text-foreground",
  warning: "text-warning",
  destructive: "text-critical",
};

export function KpiCard({
  label,
  value,
  href,
  tone = "default",
  loading,
  valueLoading,
}: Props) {
  if (loading) return <KpiCardSkeleton />;
  const inner = (
    <Card
      className={
        href ? "hover:bg-muted/40 cursor-pointer transition-colors" : ""
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {valueLoading ? (
          // Single skeleton sized to the loaded value's line height
          // (h-9 == text-3xl) so the card doesn't grow taller while the
          // count resolves and then snap back — the old second "warming"
          // subline caused that vertical layout shift (#127). The skeleton
          // is still the loading affordance (vs a bare "—").
          <Skeleton className="h-9 w-16" />
        ) : (
          <p className={`text-3xl font-bold tabular-nums ${toneClasses[tone]}`}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
