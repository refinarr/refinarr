import type { FlaggedMovie, ScoringMode } from "@/shared/types/models";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/client/components/ui/accordion";
import { Checkbox } from "@/client/components/ui/checkbox";
import { ScoreLabel } from "@/client/components/media/ScoreLabel";
import { CfScoreList } from "@/client/components/media/CfScoreList";

interface Props {
  movie: FlaggedMovie;
  selected: boolean;
  onToggle: () => void;
  scoringMode: ScoringMode;
}

export function MovieAccordionItem({ movie, selected, onToggle, scoringMode }: Props) {
  const hasCfs = movie.customFormats.length > 0 || movie.missingFormats.length > 0;
  const score = scoringMode === "profile" ? movie.customFormatScore : movie.cfScore;

  return (
    <AccordionItem value={`movie-${movie.id}`}>
      <AccordionTrigger className="px-3">
        <div className="flex w-full items-center justify-between gap-4 pr-2">
          <div className="flex items-center gap-3 min-w-0">
            <span
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="shrink-0"
            >
              <Checkbox checked={selected} onCheckedChange={onToggle} />
            </span>
            <span className="font-medium truncate">{movie.title}</span>
            <span className="text-muted-foreground text-sm shrink-0">{movie.year}</span>
          </div>
          <ScoreLabel score={score} minProfileScore={movie.minProfileScore} />
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="px-4 py-2">
          {!movie.hasFile ? (
            <p className="text-sm text-muted-foreground">No file downloaded.</p>
          ) : hasCfs ? (
            <CfScoreList formats={movie.customFormats} missingFormats={movie.missingFormats} />
          ) : (
            <p className="text-sm text-muted-foreground">No custom format data.</p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
