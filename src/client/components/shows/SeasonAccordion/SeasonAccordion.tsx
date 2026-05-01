import type { EpisodeFileEntry, ScoringMode } from "@/shared/types/models";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/client/components/ui/accordion";
import { EpisodeFileRow } from "../EpisodeFileRow";

interface Props {
  season: number;
  files: EpisodeFileEntry[];
  scoringMode: ScoringMode;
}

export function SeasonAccordion({ season, files, scoringMode }: Props) {
  const affectedCount =
    scoringMode === "profile"
      ? files.filter((f) => f.minProfileScore !== undefined && f.customFormatScore < f.minProfileScore).length
      : files.filter((f) => f.missingFormats.length > 0).length;

  return (
    <AccordionItem value={`season-${season}`}>
      <AccordionTrigger className="px-3">
        <div className="flex w-full items-center justify-between pr-2">
          <span className="text-sm font-medium">Season {season}</span>
          <span className="text-xs text-muted-foreground">
            {affectedCount} / {files.length} episodes
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col gap-1.5 px-1 pt-1">
          {files.map((f) => (
            <EpisodeFileRow key={f.id} file={f} scoringMode={scoringMode} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
