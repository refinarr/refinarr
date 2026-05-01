"use client";
import { Input } from "@/client/components/ui/input";
import { Slider } from "@/client/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { Search } from "lucide-react";
import { useQualityProfiles } from "@/client/hooks/useQualityProfiles";
import { usePreferences } from "@/client/hooks/usePreferences";
import { useCustomFormats } from "@/client/hooks/useCustomFormats";
import type { ArrType, ScoringMode } from "@/shared/types/models";
import type { MediaFilters } from "@/client/hooks/useMoviesPage";

interface Props {
  arrType: ArrType;
  instanceId: number;
  scoringMode: ScoringMode;
  filters: MediaFilters;
  onChange: (next: Partial<MediaFilters>) => void;
}

const ALL = "__all__";

export function MediaSearchBar({ arrType, instanceId, scoringMode, filters, onChange }: Props) {
  const { data: profiles } = useQualityProfiles(arrType, instanceId);
  const { data: prefs } = usePreferences(instanceId);
  const { data: cfs } = useCustomFormats(arrType, instanceId);

  const cfOptions = scoringMode === "manual"
    ? (prefs ?? []).map((p) => ({ id: p.cfId, name: p.cfName }))
    : (cfs ?? []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Search title or missing CF…"
          className="pl-9"
        />
      </div>

      <Select
        value={filters.profileId === null ? ALL : String(filters.profileId)}
        onValueChange={(v) => onChange({ profileId: v === ALL ? null : Number(v) })}
      >
        <SelectTrigger className="w-44">
          <SelectValue>
            {filters.profileId === null
              ? "All profiles"
              : profiles?.find((p) => p.id === filters.profileId)?.name ?? "Profile"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All profiles</SelectItem>
          {(profiles ?? []).map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.missingCfId === null ? ALL : String(filters.missingCfId)}
        onValueChange={(v) => onChange({ missingCfId: v === ALL ? null : Number(v) })}
      >
        <SelectTrigger className="w-48">
          <SelectValue>
            {filters.missingCfId === null
              ? "Any missing CF"
              : `Missing: ${cfOptions.find((c) => c.id === filters.missingCfId)?.name ?? "CF"}`}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any missing CF</SelectItem>
          {cfOptions.map((cf) => (
            <SelectItem key={cf.id} value={String(cf.id)}>{cf.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.sortBy}
        onValueChange={(v) => v && onChange({ sortBy: v as MediaFilters["sortBy"] })}
      >
        <SelectTrigger className="w-32">
          <SelectValue>{filters.sortBy === "score" ? "Score" : filters.sortBy === "title" ? "Title" : "Added"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="score">Score</SelectItem>
          <SelectItem value="title">Title</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 min-w-48">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Max score</span>
        <Slider
          value={filters.maxScore}
          onValueChange={(v) => onChange({ maxScore: v as number })}
          min={0}
          max={1}
          step={0.05}
          className="flex-1"
        />
        <span className="text-xs tabular-nums w-10 text-right">{Math.round(filters.maxScore * 100)}%</span>
      </div>
    </div>
  );
}
