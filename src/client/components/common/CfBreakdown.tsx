import { useTranslations } from "next-intl";
import { CfScoreList } from "@/client/components/common/CfScoreList";
import type { CustomFormat } from "@/shared/types/models";

interface Props {
  customFormats: CustomFormat[];
  missingFormats: CustomFormat[];
}

// Full CF breakdown for the detail drawer, split into clearly-labeled
// groups: "Current formats" — what the file actually has (penalties show
// as red −scores) — vs "Missing" — wanted formats the file lacks. The
// card surfaces only a count pill; this is where the named detail lives.
export function CfBreakdown({ customFormats, missingFormats }: Props) {
  const t = useTranslations("common");
  if (customFormats.length === 0 && missingFormats.length === 0) return null;

  return (
    <div className="space-y-2">
      {customFormats.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1 text-xs">
            {t("currentFormats")}
          </p>
          <CfScoreList formats={customFormats} missingFormats={[]} />
        </div>
      )}
      {missingFormats.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1 text-xs">
            {t("missingFormats")}
          </p>
          <CfScoreList formats={[]} missingFormats={missingFormats} />
        </div>
      )}
    </div>
  );
}
