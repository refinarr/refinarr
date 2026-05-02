"use client";
import { useTranslations } from "next-intl";
import { ServerOff } from "lucide-react";
import { Button } from "@/client/components/ui/button";

interface Props {
  onAdd: () => void;
}

export function NoInstancesPrompt({ onAdd }: Props) {
  const t = useTranslations("states.noInstances");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <ServerOff className="h-12 w-12 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold">{t("title")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("body")}</p>
      </div>
      <Button onClick={onAdd}>{t("cta")}</Button>
    </div>
  );
}
