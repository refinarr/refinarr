import type { CustomFormat } from "@/shared/types/models";

interface Props {
  formats: CustomFormat[];
  missingFormats: CustomFormat[];
}

export function CfScoreList({ formats, missingFormats }: Props) {
  if (formats.length === 0 && missingFormats.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-0.5">
      {formats.map((cf) => (
        <span key={cf.id}>
          <span className="text-foreground/80">{`${cf.name}: `}</span>
          {cf.score !== undefined && (
            <span className={cf.score >= 0 ? "text-green-400" : "text-destructive"}>
              {cf.score > 0 ? "+" : ""}{cf.score}
            </span>
          )}
        </span>
      ))}
      {missingFormats.map((cf) => (
        <span key={cf.id} className="line-through text-destructive/70">{cf.name}</span>
      ))}
    </div>
  );
}
