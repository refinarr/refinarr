"use client";
import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { Button } from "@/client/components/ui/button";

interface Props {
  onClear: () => void;
}

export function NoFilterMatchState({ onClear }: Props) {
  const t = useTranslations("states.noFilterMatch");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <SearchX className="text-muted-foreground size-12" />
      <div>
        <p className="text-lg font-semibold">{t("title")}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t("body")}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onClear}>
        {t("cta")}
      </Button>
    </div>
  );
}
