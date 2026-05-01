"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";

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
  warning: "text-yellow-400",
  destructive: "text-destructive",
};

export function KpiCard({ label, value, href, tone = "default", loading }: Props) {
  const inner = (
    <Card className={href ? "transition-colors hover:bg-muted/40 cursor-pointer" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-9 w-16 rounded bg-muted/40 animate-pulse" />
        ) : (
          <p className={`text-3xl font-bold tabular-nums ${toneClasses[tone]}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
