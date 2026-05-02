"use client";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";

export function AllClearState() {
  const t = useTranslations("states.allClear");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <CheckCircle2 className="h-12 w-12 text-green-500" />
      <div>
        <p className="text-lg font-semibold">{t("title")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("body")}</p>
      </div>
    </div>
  );
}
