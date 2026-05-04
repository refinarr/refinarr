"use client";
import { useTranslations } from "next-intl";
import { cn } from "@/client/lib/utils";
import { useInstanceHealth } from "@/client/hooks/data/useInstances";

interface Props {
  instanceId: number;
}

type ConnState = "checking" | "connected" | "disconnected";

const DOT_CLASS: Record<ConnState, string> = {
  checking: "bg-muted-foreground/40 animate-pulse",
  connected: "bg-emerald-500",
  disconnected: "bg-destructive",
};

const LABEL_KEY: Record<ConnState, string> = {
  checking: "checking",
  connected: "connected",
  disconnected: "disconnected",
};

function getConnState(isLoading: boolean, ok: boolean): ConnState {
  if (isLoading) return "checking";
  return ok ? "connected" : "disconnected";
}

export function InstanceConnectionDot({ instanceId }: Props) {
  const t = useTranslations("instanceHealth");
  const { data, isError, isLoading } = useInstanceHealth(instanceId);
  const ok = !isError && data?.ok === true;
  const state = getConnState(isLoading, ok);
  const label = t(LABEL_KEY[state]);

  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full", DOT_CLASS[state])}
      title={label}
      aria-label={label}
    />
  );
}
