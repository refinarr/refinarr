"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/client/components/ui/button";
import { Search, Trash2, EyeOff } from "lucide-react";

interface Props {
  selectedCount: number;
  onSearch: () => void;
  onDelete: (search: boolean) => void;
  onIgnore: () => void;
  disabled?: boolean;
}

export function BulkActionToolbar({ selectedCount, onSearch, onDelete, onIgnore, disabled }: Props) {
  const t = useTranslations("bulk");
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 p-3 bg-accent rounded-md mb-4">
      <span className="text-sm font-medium">{t("selected", { count: selectedCount })}</span>
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" onClick={onSearch} disabled={disabled}>
          <Search className="h-4 w-4 mr-1" /> {t("search")}
        </Button>
        <Button size="sm" variant="outline" onClick={onIgnore} disabled={disabled}>
          <EyeOff className="h-4 w-4 mr-1" /> {t("ignore")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDelete(false)} disabled={disabled}>
          <Trash2 className="h-4 w-4 mr-1 text-destructive" /> {t("delete")}
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(true)} disabled={disabled}>
          <Trash2 className="h-4 w-4 mr-1" /> {t("deleteAndSearch")}
        </Button>
      </div>
    </div>
  );
}
