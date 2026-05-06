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
      <ServerOff className="text-muted-foreground size-12" />
      <div>
        <p className="text-lg font-semibold">{t("title")}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t("body")}</p>
      </div>
      <Button onClick={onAdd}>{t("cta")}</Button>
    </div>
  );
}
