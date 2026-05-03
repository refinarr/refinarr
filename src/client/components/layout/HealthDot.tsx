"use client";
import { useHealth } from "@/client/hooks/data/useHealth";

export function HealthDot() {
  const { data, isError } = useHealth();
  const ok = !isError && data?.status === "ok";
  return (
    <span
      className={`h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
      title={ok ? "Connected" : "Disconnected"}
    />
  );
}
