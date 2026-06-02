"use client";
import { useTranslations } from "next-intl";
import { Search, Trash2 } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { CfBreakdown } from "@/client/components/common/CfBreakdown";
import { isProfileMode } from "@/shared/scoring-mode";
import type { EpisodeFileEntry, ScoringMode } from "@/shared/types/models";
import { filename } from "../utils";

interface Props {
  file: EpisodeFileEntry;
  scoringMode: ScoringMode;
  onSearch: () => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}

export function EpisodeFileRow({
  file,
  scoringMode,
  onSearch,
  onDelete,
}: Props) {
  const t = useTranslations("common");
  const name = filename(file.relativePath);
  const isBad = isProfileMode(scoringMode)
    ? file.minProfileScore !== undefined &&
      file.customFormatScore < file.minProfileScore
    : file.missingFormats.length > 0;

  return (
    <div
      className={`group rounded-md border px-3 py-2 ${
        isBad ? "border-destructive/30 bg-destructive/5" : "bg-muted/20"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <span
          className="text-muted-foreground truncate font-mono text-xs"
          title={file.relativePath}
        >
          {name}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {isProfileMode(scoringMode) && (
            <ScoreLabel
              score={file.customFormatScore}
              minProfileScore={file.minProfileScore}
            />
          )}
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title={t("search")}
              aria-label={t("search")}
              onClick={() => onSearch()}
            >
              <Search className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title={t("delete")}
              aria-label={t("delete")}
              onClick={() => onDelete()}
            >
              <Trash2 className="text-destructive size-3.5" />
            </Button>
          </div>
        </div>
      </div>
      <CfBreakdown
        customFormats={file.customFormats}
        missingFormats={file.missingFormats}
      />
    </div>
  );
}
