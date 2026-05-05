"use client";
import { useTranslations } from "next-intl";
import type { EpisodeFileEntry, ScoringMode } from "@/shared/types/models";
import { isProfileMode } from "@/shared/scoring-mode";
import { Button } from "@/client/components/ui/button";
import { Search, Trash2 } from "lucide-react";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { CfScoreList } from "@/client/components/common/CfScoreList";
import { filename } from "../utils";

interface Props {
  file: EpisodeFileEntry;
  scoringMode: ScoringMode;
  onSearch: () => Promise<unknown>;
  onDelete: (search: boolean) => Promise<unknown>;
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
          className="font-mono text-xs text-muted-foreground truncate"
          title={file.relativePath}
        >
          {name}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isProfileMode(scoringMode) && (
            <ScoreLabel
              score={file.customFormatScore}
              minProfileScore={file.minProfileScore}
            />
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={t("search")}
              aria-label={t("search")}
              onClick={() => onSearch()}
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={t("delete")}
              aria-label={t("delete")}
              onClick={() => onDelete(false)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
      <CfScoreList
        formats={file.customFormats}
        missingFormats={file.missingFormats}
      />
    </div>
  );
}
