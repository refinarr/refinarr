"use client";
import { useTranslations } from "next-intl";
import { cn } from "@/client/lib/utils";
import { useInstanceHealth } from "@/client/hooks/data/useInstances";

interface Props {
  instanceId: number;
}

export function InstanceConnectionDot({ instanceId }: Props) {
  const t = useTranslations("instanceHealth");
  const { data, isError, isLoading } = useInstanceHealth(instanceId);
  const ok = !isError && data?.ok === true;
  const label = isLoading ? t("checking") : ok ? t("connected") : t("disconnected");

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        isLoading ? "bg-muted-foreground/40 animate-pulse"
          : ok ? "bg-emerald-500"
          : "bg-destructive",
      )}
      title={label}
      aria-label={label}
    />
  );
}
