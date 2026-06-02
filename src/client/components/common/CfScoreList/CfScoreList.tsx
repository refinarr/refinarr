import { useState } from "react";
import { useTranslations } from "next-intl";
import { CfScore } from "@/client/components/common/CfScore";
import type { CustomFormat } from "@/shared/types/models";

interface Props {
  formats: CustomFormat[];
  missingFormats: CustomFormat[];
  collapseMissingAfter?: number;
  // Compact mode for the media card: collapse the formats to a readable
  // count pill ("N penalties" / "N missing formats") instead of the chip
  // list — long CF names can't fit legibly on a card. The full named list
  // shows in the detail drawer (tap the card).
  dense?: boolean;
}

export function CfScoreList({
  formats,
  missingFormats,
  collapseMissingAfter = 8,
  dense = false,
}: Props) {
  const tCommon = useTranslations("common");
  const [showAllMissing, setShowAllMissing] = useState(false);
  if (formats.length === 0 && missingFormats.length === 0) return null;

  if (dense) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        {formats.length > 0 && (
          <span className="bg-critical/10 text-critical/90 inline-flex items-center rounded-sm px-1.5 py-0.5 tabular-nums">
            {tCommon("penaltyCount", { count: formats.length })}
          </span>
        )}
        {missingFormats.length > 0 && (
          <span className="bg-destructive/10 text-destructive/80 inline-flex items-center rounded-sm px-1.5 py-0.5 tabular-nums">
            {tCommon("missingCount", { count: missingFormats.length })}
          </span>
        )}
      </div>
    );
  }

  const sortedFormats = [...formats].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  );
  const visibleMissing = showAllMissing
    ? missingFormats
    : missingFormats.slice(0, collapseMissingAfter);
  const hiddenCount = missingFormats.length - visibleMissing.length;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {sortedFormats.map((cf) => (
        <CfScore key={`p-${cf.id}`} name={cf.name} score={cf.score} />
      ))}
      {visibleMissing.map((cf) => (
        <CfScore key={`m-${cf.id}`} name={cf.name} variant="missing" />
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground px-1.5 text-xs underline-offset-2 hover:underline"
          onClick={() => setShowAllMissing(true)}
        >
          {tCommon("moreCount", { count: hiddenCount })}
        </button>
      )}
    </div>
  );
}
