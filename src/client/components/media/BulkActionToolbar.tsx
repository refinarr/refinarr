"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/client/components/ui/button";
import { Search, Trash2, EyeOff, X } from "lucide-react";

export type BulkAction = "search" | "ignore" | "delete";

export interface BulkProgress {
  current: number;
  total: number;
  action: BulkAction;
}

interface Props {
  selectedCount: number;
  onSearch: () => void;
  onDelete: (search: boolean) => void;
  onIgnore: () => void;
  disabled?: boolean;
  progress?: BulkProgress | null;
  onCancel?: () => void;
}

export function BulkActionToolbar({
  selectedCount,
  onSearch,
  onDelete,
  onIgnore,
  disabled,
  progress,
  onCancel,
}: Props) {
  const t = useTranslations("bulk");
  if (selectedCount === 0 && !progress) return null;

  const wrapperClasses =
    "fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t bg-background px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:static md:mb-4 md:rounded-md md:border-0 md:bg-accent md:px-3 md:py-3";

  if (progress) {
    const pct = progress.total > 0 ? Math.min(100, (progress.current / progress.total) * 100) : 0;
    return (
      <div className={wrapperClasses}>
        <div role="status" aria-live="polite" className="text-sm font-medium">
          {t(`progress.${progress.action}`, { current: progress.current, total: progress.total })}
        </div>
        <div className="ml-auto h-1 w-24 overflow-hidden rounded bg-muted-foreground/20">
          <div
            className="h-full rounded bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {onCancel && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onCancel}
            aria-label={t("cancel")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={wrapperClasses}>
      <span className="text-sm font-medium">{t("selected", { count: selectedCount })}</span>
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" onClick={onSearch} disabled={disabled} aria-label={t("search")}>
          <Search className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">{t("search")}</span>
        </Button>
        <Button size="sm" variant="outline" onClick={onIgnore} disabled={disabled} aria-label={t("ignore")}>
          <EyeOff className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">{t("ignore")}</span>
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDelete(false)} disabled={disabled} aria-label={t("delete")}>
          <Trash2 className="h-4 w-4 text-destructive sm:mr-1" />
          <span className="hidden sm:inline">{t("delete")}</span>
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(true)} disabled={disabled} aria-label={t("deleteAndSearch")}>
          <Trash2 className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">{t("deleteAndSearch")}</span>
        </Button>
      </div>
    </div>
  );
}
