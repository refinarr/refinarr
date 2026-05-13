"use client";
import { Badge } from "@/client/components/ui/badge";

// `action` is intentionally typed as `string` — values arrive parsed
// from log context JSON, where the boundary is genuinely string. We
// don't widen the runtime contract by lying with a union type the
// JSON parser couldn't enforce.
interface Props {
  action: string;
}

// Map action kinds to the codebase's status palette so badges retint
// alongside the rest of the UI on theme switches. Buckets:
//   • ok      — happy-path content actions (movie / series)
//   • info    — sub-scope variants (season / episode / search_*)
//   • warning — a search operation in flight (Servarr query)
//   • critical — destructive (delete)
//   • neutral — bookkeeping (ignore) / unknown action
const ACTION_STYLES: Record<string, string> = {
  movie: "border-ok/40 text-ok bg-ok-soft",
  series: "border-ok/40 text-ok bg-ok-soft",
  season: "border-info/40 text-info bg-info-soft",
  episode: "border-info/40 text-info bg-info-soft",
  search: "border-warning/40 text-warning bg-warning-soft",
  search_season: "border-info/40 text-info bg-info-soft",
  search_episode: "border-info/40 text-info bg-info-soft",
  delete: "border-critical/50 text-critical bg-critical-soft",
  ignore: "border-muted-foreground/30 text-muted-foreground bg-neutral-soft",
};

const FALLBACK =
  "border-muted-foreground/30 text-muted-foreground bg-neutral-soft";

export function ActionBadge({ action }: Props) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] ${ACTION_STYLES[action] ?? FALLBACK}`}
    >
      {action}
    </Badge>
  );
}
