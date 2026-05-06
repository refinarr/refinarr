"use client";
import { useTranslations } from "next-intl";
import { useHealth } from "@/client/hooks/data/useHealth";

export function HealthDot() {
  const t = useTranslations("health");
  const { data, isError } = useHealth();
  const ok = !isError && data?.status === "ok";
  return (
    <span
      className={`size-2 rounded-full ${ok ? "bg-ok" : "bg-critical"}`}
      title={ok ? t("connected") : t("disconnected")}
    />
  );
}
