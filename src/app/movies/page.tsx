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
import { useMovies } from "@/client/hooks/useMovies";
import { useDebouncedValue } from "@/client/hooks/useDebouncedValue";
import { useInfiniteScroll } from "@/client/hooks/useInfiniteScroll";
import { useConfig } from "@/client/hooks/useConfig";
import { usePreferences } from "@/client/hooks/usePreferences";
import { api } from "@/client/lib/api";
import { toast } from "sonner";
import type { FlaggedMovie } from "@/shared/types/models";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function ScoreLabel({ movie, scoringMode }: { movie: FlaggedMovie; scoringMode: string }) {
  if (scoringMode === "profile" && movie.minProfileScore !== undefined) {
    return <span className="tabular-nums text-sm text-muted-foreground">{movie.customFormatScore} / {movie.minProfileScore}</span>;
  }
  return <span className="tabular-nums text-sm text-muted-foreground">{Math.round(movie.cfScore * 100)}%</span>;
}

function MovieAccordionItem({
  movie,
  selected,
  onToggle,
  scoringMode,
}: {
  movie: FlaggedMovie;
  selected: boolean;
  onToggle: () => void;
  scoringMode: string;
}) {
  const hasCfs = movie.customFormats.length > 0 || movie.missingFormats.length > 0;

  return (
    <AccordionItem value={`movie-${movie.id}`}>
      <AccordionTrigger className="px-3">
        <div className="flex w-full items-center justify-between gap-4 pr-2">
          <div className="flex items-center gap-3 min-w-0">
            <span onClick={(e) => { e.stopPropagation(); onToggle(); }} className="shrink-0">
              <Checkbox checked={selected} onCheckedChange={onToggle} />
            </span>
            <span className="font-medium truncate">{movie.title}</span>
            <span className="text-muted-foreground text-sm shrink-0">{movie.year}</span>
          </div>
          <ScoreLabel movie={movie} scoringMode={scoringMode} />
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="px-4 py-2">
          {!movie.hasFile ? (
            <p className="text-sm text-muted-foreground">No file downloaded.</p>
          ) : hasCfs ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {movie.customFormats.map((cf) => (
                <span key={cf.id}>
                  <span className="text-foreground/80">{cf.name}</span>
                  {cf.score !== undefined && (
                    <span className={cf.score >= 0 ? "text-green-400" : "text-destructive"}>
                      : {cf.score > 0 ? "+" : ""}{cf.score}
                    </span>
                  )}
                </span>
              ))}
              {movie.missingFormats.map((cf) => (
                <span key={cf.id} className="line-through text-destructive/70">{cf.name}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No custom format data.</p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function MoviesPage() {
  const router = useRouter();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<{ sortBy: "score" | "title" | "added"; order: "asc" | "desc"; maxScore: number }>({ sortBy: "score", order: "asc", maxScore: 1 });

  const activeInstance = instanceId || instances?.[0]?.id || 0;
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useMovies(activeInstance, { ...filters, maxScore: debouncedMaxScore });
  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(activeInstance);
  const scoringMode = config?.scoringModes[`scoringMode:${activeInstance}`] ?? "manual";
  const noCfsConfigured = scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  const sentinelRef = useInfiniteScroll(fetchNextPage, !!hasNextPage);

  const allMovies: FlaggedMovie[] = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedMovies = allMovies.filter((m) => selected.has(m.id));

  const handleSearch = async () => {
    for (const m of selectedMovies) {
      await api.post(`/radarr/movies/search`, { instanceId: activeInstance, mediaId: m.id, title: m.title });
    }
    toast.success("Search triggered");
    setSelected(new Set());
  };

  const handleIgnore = async () => {
    for (const m of selectedMovies) {
      await api.post(`/ignore`, { instanceId: activeInstance, mediaId: m.id, mediaType: "movie", title: m.title });
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

  const radarrInstances = instances?.filter((i) => i.type === "radarr") ?? [];

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Movies</h1>
              {!isLoading && <p className="text-muted-foreground text-sm mt-1">{total} flagged</p>}
            </div>
            {radarrInstances.length > 1 && (
              <Select value={String(activeInstance)} onValueChange={(v) => setInstanceId(Number(v ?? 0))}>
                <SelectTrigger className="w-44">
                  <SelectValue>{radarrInstances.find((i) => i.id === activeInstance)?.name ?? "Select instance"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {radarrInstances.map((i) => (
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
            onDelete={() => toast.error("Delete: select items first")}
            onIgnore={handleIgnore}
          />

          {(isLoading || loadingInstances) && <MediaTableSkeleton />}
          {isError && <MediaErrorCard onRetry={refetch} />}
          {!loadingInstances && !isLoading && !isError && allMovies.length === 0 && (
            activeInstance
              ? noCfsConfigured ? <NoCfsPrompt /> : <AllClearState />
              : <NoCfsPrompt />
          )}

          {!isLoading && allMovies.length > 0 && (
            <Accordion>
              {allMovies.map((movie) => (
                <MovieAccordionItem
                  key={movie.id}
                  movie={movie}
                  selected={selected.has(movie.id)}
                  onToggle={() => toggle(movie.id)}
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
