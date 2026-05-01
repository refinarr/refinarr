import type { EpisodeFileEntry, ScoringMode } from "@/shared/types/models";
import { ScoreLabel } from "@/client/components/media/ScoreLabel";
import { CfScoreList } from "@/client/components/media/CfScoreList";
import { filename } from "../utils";

interface Props {
  file: EpisodeFileEntry;
  scoringMode: ScoringMode;
}

export function EpisodeFileRow({ file, scoringMode }: Props) {
  const name = filename(file.relativePath);
  const isBad =
    scoringMode === "profile"
      ? file.minProfileScore !== undefined && file.customFormatScore < file.minProfileScore
      : file.missingFormats.length > 0;

  return (
    <div
      className={`rounded-md border px-3 py-2 ${
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
        {scoringMode === "profile" && (
          <ScoreLabel score={file.customFormatScore} minProfileScore={file.minProfileScore} />
        )}
      </div>
      <CfScoreList formats={file.customFormats} missingFormats={file.missingFormats} />
    </div>
  );
}
