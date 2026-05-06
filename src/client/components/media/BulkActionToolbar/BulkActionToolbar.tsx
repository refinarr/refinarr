"use client";
import { useTranslations } from "next-intl";
import { Search, Trash2, EyeOff, X } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import type { BulkProgress } from "./types";

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

  // Mobile: iOS Safari toolbar style — solid dark strip pinned to viewport
  // bottom, no borders, ghost icon buttons, safe-area padding for the home
  // indicator. Sized larger than desktop for thumb-friendly tap targets.
  // Desktop: card-style strip that sticks to the top of the main scroll
  // container so it stays visible while the user scrolls a long list and
  // selects rows further down.
  const wrapperClasses =
    "fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 bg-muted px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:sticky md:top-0 md:bottom-auto md:mb-4 md:gap-2 md:rounded-md md:border-0 md:bg-accent md:px-3 md:py-3 md:pb-3";

  if (progress) {
    const pct =
      progress.total > 0
        ? Math.min(100, (progress.current / progress.total) * 100)
        : 0;
    return (
      <div className={wrapperClasses}>
        <div role="status" aria-live="polite" className="text-sm font-medium">
          {t(`progress.${progress.action}`, {
            current: progress.current,
            total: progress.total,
          })}
        </div>
        <div className="bg-muted-foreground/20 ml-auto h-1 w-24 overflow-hidden rounded-sm">
          <div
            className="bg-primary h-full rounded-sm transition-all"
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
            <X className="size-4" />
          </Button>
        )}
      </div>
    );
  }

  // Buttons use size="default" on mobile (h-9 ~ 36px tap target, comfortable
  // for touch) and shrink to size="sm" on desktop via the md:h-8 override.
  // Icons grow from h-5 to h-4 the same way.
  const buttonSize = "h-10 w-10 md:h-8 md:w-auto md:px-3";
  const iconSize = "h-5 w-5 md:h-4 md:w-4 md:mr-1";

  return (
    <div className={wrapperClasses}>
      <span className="text-base font-medium md:text-sm">
        {t("selected", { count: selectedCount })}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onSearch}
          disabled={disabled}
          aria-label={t("search")}
          className={buttonSize}
        >
          <Search className={iconSize} />
          <span className="hidden md:inline">{t("search")}</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onIgnore}
          disabled={disabled}
          aria-label={t("ignore")}
          className={buttonSize}
        >
          <EyeOff className={iconSize} />
          <span className="hidden md:inline">{t("ignore")}</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(false)}
          disabled={disabled}
          aria-label={t("delete")}
          className={`${buttonSize} text-destructive hover:text-destructive`}
        >
          <Trash2 className={iconSize} />
          <span className="hidden md:inline">{t("delete")}</span>
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onDelete(true)}
          disabled={disabled}
          aria-label={t("deleteAndSearch")}
          className={buttonSize}
        >
          <Trash2 className={iconSize} />
          <span className="hidden md:inline">{t("deleteAndSearch")}</span>
        </Button>
      </div>
    </div>
  );
}
