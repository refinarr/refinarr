"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { KpiCardSkeleton } from "@/client/components/states/KpiCardSkeleton";

type Tone = "default" | "warning" | "destructive";

interface Props {
  label: string;
  value: ReactNode;
  href?: string;
  tone?: Tone;
  loading?: boolean;
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
        <p className={`text-3xl font-bold tabular-nums ${toneClasses[tone]}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
