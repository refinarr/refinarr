"use client";
import { useTranslations } from "next-intl";
import { Search, EyeOff } from "lucide-react";
import { Button } from "@/client/components/ui/button";

interface Props {
  onSearch: () => void;
  onIgnore: () => void;
  searchPending?: boolean;
  ignorePending?: boolean;
}

export function RowHoverActions({
  onSearch,
  onIgnore,
  searchPending,
  ignorePending,
}: Props) {
  const t = useTranslations("common");
  return (
    <div className="inline-flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-touch"
        title={t("search")}
        aria-label={t("search")}
        disabled={searchPending}
        onClick={onSearch}
      >
        <Search />
      </Button>
      <Button
        variant="ghost"
        size="icon-touch"
        title={t("ignore")}
        aria-label={t("ignore")}
        disabled={ignorePending}
        onClick={onIgnore}
      >
        <EyeOff />
      </Button>
    </div>
  );
}
