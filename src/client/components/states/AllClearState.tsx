"use client";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";

export function AllClearState() {
  const t = useTranslations("states.allClear");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <CheckCircle2 className="text-ok size-12" />
      <div>
        <p className="text-lg font-semibold">{t("title")}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t("body")}</p>
      </div>
    </div>
  );
}
