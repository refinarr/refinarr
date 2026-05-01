"use client";
import { useState } from "react";
import { AppShell } from "@/client/components/layout/AppShell";
import { FilterBar } from "@/client/components/media/FilterBar";
import { BulkActionToolbar } from "@/client/components/media/BulkActionToolbar";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { AllClearState } from "@/client/components/states/AllClearState";
import { NoCfsPrompt } from "@/client/components/states/NoCfsPrompt";
import { NoInstancesPrompt } from "@/client/components/states/NoInstancesPrompt";
import { MediaErrorCard } from "@/client/components/states/MediaErrorCard";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/client/components/ui/accordion";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { useInstances } from "@/client/hooks/useInstances";
import { useSeries } from "@/client/hooks/useSeries";
import { useDebouncedValue } from "@/client/hooks/useDebouncedValue";
import { useConfig } from "@/client/hooks/useConfig";
import { usePreferences } from "@/client/hooks/usePreferences";
import { useInfiniteScroll } from "@/client/hooks/useInfiniteScroll";
import { api } from "@/client/lib/api";
import { toast } from "sonner";
import type { FlaggedSeries, EpisodeFileEntry } from "@/shared/types/models";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function groupBySeason(files: EpisodeFileEntry[]): Map<number, EpisodeFileEntry[]> {
  const map = new Map<number, EpisodeFileEntry[]>();
  for (const f of files) {
    const list = map.get(f.seasonNumber) ?? [];
    list.push(f);
    map.set(f.seasonNumber, list);
  }
  return map;
}

function filename(relativePath: string): string {
  return relativePath.split("/").pop() ?? relativePath;
}

function ScoreLabel({ score, minProfileScore }: { score: number; minProfileScore?: number }) {
  if (minProfileScore !== undefined) {
    return <span className="tabular-nums text-sm text-muted-foreground">{score} / {minProfileScore}</span>;
  }
  return <span className="tabular-nums text-sm text-muted-foreground">{Math.round(score * 100)}%</span>;
}

function CfScoreList({ file }: { file: EpisodeFileEntry }) {
  const hasCfs = file.customFormats.length > 0 || file.missingFormats.length > 0;
  if (!hasCfs) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-0.5">
      {file.customFormats.map((cf) => (
        <span key={cf.id}>
          <span className="text-foreground/80">{`${cf.name}: `}</span>
          {cf.score !== undefined && (
            <span className={cf.score >= 0 ? "text-green-400" : "text-destructive"}>
               {cf.score > 0 ? "+" : ""}{cf.score}
            </span>
          )}
        </span>
      ))}
      {file.missingFormats.map((cf) => (
        <span key={cf.id} className="line-through text-destructive/70">{cf.name}</span>
      ))}
    </div>
  );
}

function EpisodeFileRow({ file, scoringMode }: { file: EpisodeFileEntry; scoringMode: string }) {
  const name = filename(file.relativePath);
  const isBad = scoringMode === "profile"
    ? file.minProfileScore !== undefined && file.customFormatScore < file.minProfileScore
    : file.missingFormats.length > 0;

  return (
    <div className={`rounded-md border px-3 py-2 ${isBad ? "border-destructive/30 bg-destructive/5" : "bg-muted/20"}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs text-muted-foreground truncate" title={file.relativePath}>{name}</span>
        {scoringMode === "profile" && (
          <ScoreLabel score={file.customFormatScore} minProfileScore={file.minProfileScore} />
        )}
      </div>
      <CfScoreList file={file} />
    </div>
  );
}

function SeasonAccordion({ season, files, scoringMode }: { season: number; files: EpisodeFileEntry[]; scoringMode: string }) {
  const affectedCount = scoringMode === "profile"
    ? files.filter((f) => f.minProfileScore !== undefined && f.customFormatScore < f.minProfileScore).length
    : files.filter((f) => f.missingFormats.length > 0).length;

  return (
    <AccordionItem value={`season-${season}`}>
      <AccordionTrigger className="px-3">
        <div className="flex w-full items-center justify-between pr-2">
          <span className="text-sm font-medium">Season {season}</span>
          <span className="text-xs text-muted-foreground">{affectedCount} / {files.length} episodes</span>
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

function SeriesAccordionItem({
  series,
  selected,
  onToggle,
  scoringMode,
}: {
  series: FlaggedSeries;
  selected: boolean;
  onToggle: () => void;
  scoringMode: string;
}) {
  const seasonMap = groupBySeason(series.episodeFiles);
  const seasons = Array.from(seasonMap.keys()).sort((a, b) => a - b);

  return (
    <AccordionItem value={`series-${series.id}`}>
      <AccordionTrigger className="px-3">
        <div className="flex w-full items-center justify-between gap-4 pr-2">
          <div className="flex items-center gap-3 min-w-0">
            <span onClick={(e) => { e.stopPropagation(); onToggle(); }} className="shrink-0">
              <Checkbox checked={selected} onCheckedChange={onToggle} />
            </span>
            <span className="font-medium truncate">{series.title}</span>
            <span className="text-muted-foreground text-sm shrink-0">{series.year}</span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <ScoreLabel
              score={scoringMode === "profile" ? series.customFormatScore : series.cfScore}
              minProfileScore={series.minProfileScore}
            />
            <span className="text-xs text-muted-foreground">
              {series.affectedEpisodeCount} / {series.totalEpisodeCount} episodes
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {seasons.length > 0 ? (
          <Accordion className="pl-4">
            {seasons.map((season) => (
              <SeasonAccordion
                key={season}
                season={season}
                files={seasonMap.get(season)!}
                scoringMode={scoringMode}
              />
            ))}
          </Accordion>
        ) : (
          <p className="text-sm text-muted-foreground px-3 py-1">No episode files found.</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export default function ShowsPage() {
  const router = useRouter();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<{ sortBy: "score" | "title" | "added"; order: "asc" | "desc"; maxScore: number }>({ sortBy: "score", order: "asc", maxScore: 1 });

  const activeInstance = instanceId || instances?.find((i) => i.type === "sonarr")?.id || 0;
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useSeries(activeInstance, { ...filters, maxScore: debouncedMaxScore });
  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(activeInstance);
  const scoringMode = config?.scoringModes[`scoringMode:${activeInstance}`] ?? "manual";
  const noCfsConfigured = scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  const sentinelRef = useInfiniteScroll(fetchNextPage, !!hasNextPage);

  const allSeries: FlaggedSeries[] = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedSeries = allSeries.filter((s) => selected.has(s.id));

  const handleSearch = async () => {
    for (const s of selectedSeries) {
      await api.post(`/sonarr/series/search`, { instanceId: activeInstance, mediaId: s.id, title: s.title });
    }
    toast.success("Search triggered");
    setSelected(new Set());
  };

  const handleIgnore = async () => {
    for (const s of selectedSeries) {
      await api.post(`/ignore`, { instanceId: activeInstance, mediaId: s.id, mediaType: "series", title: s.title });
    }
    toast.success("Items ignored");
    setSelected(new Set());
    refetch();
  };

  if (!loadingInstances && !instances?.length) {
    return (
      <AppShell>
        <NoInstancesPrompt onAdd={() => router.push("/settings")} />
      </AppShell>
    );
  }

  const sonarrInstances = instances?.filter((i) => i.type === "sonarr") ?? [];

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Shows</h1>
              {!isLoading && <p className="text-muted-foreground text-sm mt-1">{total} flagged</p>}
            </div>
            {sonarrInstances.length > 1 && (
              <Select value={String(activeInstance)} onValueChange={(v) => setInstanceId(Number(v ?? 0))}>
                <SelectTrigger className="w-44">
                  <SelectValue>{sonarrInstances.find((i) => i.id === activeInstance)?.name ?? "Select instance"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sonarrInstances.map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <FilterBar filters={filters} onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))} />

          <BulkActionToolbar
            selectedCount={selected.size}
            onSearch={handleSearch}
            onDelete={() => toast.error("Delete: not supported for series")}
            onIgnore={handleIgnore}
          />

          {(isLoading || loadingInstances) && <MediaTableSkeleton rows={8} />}
          {isError && <MediaErrorCard onRetry={refetch} />}
          {!loadingInstances && !isLoading && !isError && allSeries.length === 0 && (
            activeInstance
              ? noCfsConfigured ? <NoCfsPrompt /> : <AllClearState />
              : <NoCfsPrompt />
          )}

          {!isLoading && allSeries.length > 0 && (
            <Accordion>
              {allSeries.map((series) => (
                <SeriesAccordionItem
                  key={series.id}
                  series={series}
                  selected={selected.has(series.id)}
                  onToggle={() => toggle(series.id)}
                  scoringMode={scoringMode}
                />
              ))}
            </Accordion>
          )}

          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
