"use client";
import { useTranslations } from "next-intl";
import { ListX } from "lucide-react";

export function NoCfsPrompt() {
  const t = useTranslations("states.noCfs");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <ListX className="h-12 w-12 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold">{t("title")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("body")}</p>
      </div>
    </div>
  );
}
