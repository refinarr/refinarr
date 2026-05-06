"use client";
import { useTranslations } from "next-intl";
import { ClipboardList } from "lucide-react";

export function EmptyLogs() {
  const t = useTranslations("states.emptyLogs");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <ClipboardList className="text-muted-foreground size-12" />
      <div>
        <p className="text-lg font-semibold">{t("title")}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t("body")}</p>
      </div>
    </div>
  );
}
