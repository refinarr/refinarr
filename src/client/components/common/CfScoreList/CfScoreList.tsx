import { useState } from "react";
import { useTranslations } from "next-intl";
import { CfScore } from "@/client/components/common/CfScore";
import type { CustomFormat } from "@/shared/types/models";

interface Props {
  formats: CustomFormat[];
  missingFormats: CustomFormat[];
  collapseMissingAfter?: number;
}

export function CfScoreList({
  formats,
  missingFormats,
  collapseMissingAfter = 8,
}: Props) {
  const tCommon = useTranslations("common");
  const [showAllMissing, setShowAllMissing] = useState(false);
  if (formats.length === 0 && missingFormats.length === 0) return null;

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
