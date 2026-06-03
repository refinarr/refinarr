"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Download, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { CfScore } from "@/client/components/common/CfScore";
import { formatBytes } from "@/client/lib/format";
import { withToast } from "@/client/lib/with-toast";
import { cn } from "@/client/lib/utils";
import {
  useReleases,
  useGrabRelease,
  type ReleaseTarget,
} from "@/client/hooks/data/useReleases";
import type { ArrType } from "@/shared/types/models";
import type { ReleaseCandidate } from "@/shared/types/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  arrType: ArrType;
  instanceId: number;
  // Header subject — movie title or "Series — Season N".
  title: string;
  target: ReleaseTarget;
}

export function ReleasePickerDialog({
  open,
  onOpenChange,
  arrType,
  instanceId,
  title,
  target,
}: Props) {
  const t = useTranslations("releasePicker");
  const tToast = useTranslations("toast.grab");
  const mediaId = target.kind === "movie" ? target.movieId : target.seriesId;

  const { data, isLoading, isError, refetch } = useReleases(
    arrType,
    instanceId,
    target,
    open,
  );
  const grab = useGrabRelease(arrType);
  const grabWithToast = withToast(grab, {
    success: (r) => (r.isDryRun ? tToast("queuedDryRun") : tToast("started")),
    error: tToast("failed"),
  });

  const [grabbingGuid, setGrabbingGuid] = useState<string | null>(null);

  const onGrab = async (rel: ReleaseCandidate) => {
    setGrabbingGuid(rel.guid);
    try {
      await grabWithToast({
        instanceId,
        mediaId,
        guid: rel.guid,
        indexerId: rel.indexerId,
        title,
      });
      onOpenChange(false);
    } catch {
      // withToast already surfaced the error; keep the dialog open.
    } finally {
      setGrabbingGuid(null);
    }
  };

  const releases = data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-base">{t("title")}</DialogTitle>
          <DialogDescription className="truncate">
            {t("subtitle", { title })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading && (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
              <Loader2 className="size-4 animate-spin" /> {t("loading")}
            </div>
          )}
          {isError && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-muted-foreground text-sm">{t("error")}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t("retry")}
              </Button>
            </div>
          )}
          {!isLoading && !isError && releases.length === 0 && (
            <p className="text-muted-foreground py-16 text-center text-sm">
              {t("empty")}
            </p>
          )}
          {!isLoading && !isError && releases.length > 0 && (
            <ul className="space-y-2">
              {releases.map((r) => (
                <ReleaseRow
                  key={`${r.indexerId}:${r.guid}`}
                  release={r}
                  grabbing={grabbingGuid === r.guid}
                  disabled={grabbingGuid !== null}
                  onGrab={() => onGrab(r)}
                />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface RowProps {
  release: ReleaseCandidate;
  grabbing: boolean;
  disabled: boolean;
  onGrab: () => void;
}

function ReleaseRow({ release: r, grabbing, disabled, onGrab }: RowProps) {
  const t = useTranslations("releasePicker");
  let age: string | null = null;
  if (r.ageHours !== undefined) {
    age =
      r.ageHours >= 24
        ? t("ageDays", { n: Math.floor(r.ageHours / 24) })
        : t("ageHours", { n: r.ageHours });
  }
  return (
    <li
      className={cn(
        "rounded-md border p-3",
        !r.downloadAllowed && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={r.title}>
            {r.title}
          </p>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
            <span>{r.quality}</span>
            <span>{r.indexer}</span>
            <span>{formatBytes(r.size)}</span>
            {r.protocol === "torrent" && r.seeders != null && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> {r.seeders}
              </span>
            )}
            {age && <span>{age}</span>}
            <span
              className={r.customFormatScore < 0 ? "text-critical" : "text-ok"}
            >
              {t("scoreLabel", { score: r.customFormatScore })}
            </span>
          </div>
          {r.customFormats.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {r.customFormats.map((cf) => (
                <CfScore key={cf.id} name={cf.name} score={cf.score} />
              ))}
            </div>
          )}
          {!r.downloadAllowed && r.rejections.length > 0 && (
            <p className="text-destructive/80 mt-1.5 text-xs">
              {t("rejected", { reason: r.rejections.join("; ") })}
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={onGrab}
          disabled={disabled || !r.downloadAllowed}
          title={!r.downloadAllowed ? t("notAllowed") : undefined}
        >
          {grabbing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          {t("grab")}
        </Button>
      </div>
    </li>
  );
}
