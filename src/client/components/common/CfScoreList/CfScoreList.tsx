import { useState } from "react";
import { useTranslations } from "next-intl";
import { CfScore } from "@/client/components/common/CfScore";
import type { CustomFormat } from "@/shared/types/models";

interface Props {
  formats: CustomFormat[];
  missingFormats: CustomFormat[];
  collapseMissingAfter?: number;
  // Single-line mode for the media card: show the most impactful formats
  // (worst penalties first), clamp to `maxVisible` with a "+N" tail, and
  // let each chip ellipsize so the row never wraps — keeps card height
  // bounded. The full list still shows in the detail drawer.
  dense?: boolean;
  maxVisible?: number;
}

export function CfScoreList({
  formats,
  missingFormats,
  collapseMissingAfter = 8,
  dense = false,
  maxVisible = 3,
}: Props) {
  const tCommon = useTranslations("common");
  const [showAllMissing, setShowAllMissing] = useState(false);
  if (formats.length === 0 && missingFormats.length === 0) return null;

  if (dense) {
    // Worst penalties first (most negative score) so the card surfaces the
    // formats that matter most; missing formats follow.
    const ordered = [...formats].sort(
      (a, b) => (a.score ?? 0) - (b.score ?? 0),
    );
    const chips = [
      ...ordered.map((cf) => (
        <CfScore key={`p-${cf.id}`} name={cf.name} score={cf.score} truncate />
      )),
      ...missingFormats.map((cf) => (
        <CfScore key={`m-${cf.id}`} name={cf.name} variant="missing" truncate />
      )),
    ];
    const visible = chips.slice(0, maxVisible);
    const hidden = chips.length - visible.length;
    return (
      <div className="mt-1 flex items-center gap-1">
        {visible}
        {hidden > 0 && (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {tCommon("moreCount", { count: hidden })}
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
