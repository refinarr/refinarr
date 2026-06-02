"use client";
import { useTranslations } from "next-intl";
import { ListX } from "lucide-react";

export function NoCfsPrompt() {
  const t = useTranslations("states.noCfs");
  return (
    <div
      data-testid="empty-no-cfs"
      className="flex flex-col items-center justify-center gap-4 py-20 text-center"
    >
      <ListX className="text-muted-foreground size-12" />
      <div>
        <p className="text-lg font-semibold">{t("title")}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t("body")}</p>
      </div>
    </div>
  );
}
