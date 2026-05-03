import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/client/lib/api";
import { withToast } from "@/client/lib/with-toast";
import { runSerial } from "@/client/lib/run-serial";
import { isAbortError } from "./useBulkAbort";
import type { ActionLog } from "@/shared/types/models";
import type { BulkAction, BulkProgress } from "@/client/components/media/BulkActionToolbar";

export interface BulkVars<T> {
  items: T[];
  isBulk: boolean;
  signal?: AbortSignal;
}

export interface DeleteVars<T> extends BulkVars<T> {
  search: boolean;
}

interface EndpointConfig<T> {
  endpoint: string;
  body: (item: T, instId: number) => Record<string, unknown>;
}

interface DeleteEndpointConfig<T> {
  endpoint: string;
  isDeletable: (item: T) => boolean;
  body: (item: T, instId: number, search: boolean) => Record<string, unknown>;
}

type MediaToastVariant = "movie" | "series";

export interface BulkActionsConfig<T> {
  instanceId: number;
  setProgress: (p: BulkProgress | null) => void;
  refetch: () => unknown;
  mediaType: MediaToastVariant;
  search: EndpointConfig<T>;
  ignore: EndpointConfig<T>;
  delete: DeleteEndpointConfig<T>;
}

interface RunOptions {
  isBulk: boolean;
  signal?: AbortSignal;
  action: BulkAction;
  setProgress: (p: BulkProgress | null) => void;
}

async function runBulk<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  opts: RunOptions,
): Promise<R[]> {
  const total = items.length;
  if (opts.isBulk) opts.setProgress({ current: 0, total, action: opts.action });
  return runSerial(
    items,
    async (item, i) => {
      const r = await fn(item);
      if (opts.isBulk) opts.setProgress({ current: i + 1, total, action: opts.action });
      return r;
    },
    undefined,
    { signal: opts.signal },
  );
}

export function useBulkMediaActions<T>(config: BulkActionsConfig<T>) {
  const { instanceId, setProgress, refetch, mediaType } = config;
  const tSearch = useTranslations("toast.search");
  const tDelete = useTranslations("toast.delete");
  const tIgnore = useTranslations("toast.ignore");
  const tBulk = useTranslations("bulk");

  const deleteDone = mediaType === "movie" ? tDelete("fileDone") : tDelete("filesDone");
  const deleteDoneAndSearch = mediaType === "movie" ? tDelete("fileDoneAndSearch") : tDelete("filesDoneAndSearch");
  const deleteFailed = mediaType === "movie" ? tDelete("fileFailed") : tDelete("filesFailed");

  const searchMutation = useMutation({
    mutationFn: ({ items, isBulk, signal }: BulkVars<T>) =>
      runBulk(
        items,
        (item) => api.post<ActionLog>(config.search.endpoint, config.search.body(item, instanceId)),
        { isBulk, signal, action: "search", setProgress },
      ),
    onSuccess: (results) => {
      if (results.some((r) => r.isDryRun)) toast.info(tSearch("queuedDryRun"));
      else toast.success(tSearch("started"));
    },
    onError: (e) => {
      if (isAbortError(e)) toast.info(tBulk("cancelled"));
      else toast.error(tSearch("failed"));
    },
    onSettled: () => setProgress(null),
  });

  const ignoreMutation = useMutation({
    mutationFn: ({ items, isBulk, signal }: BulkVars<T>) =>
      runBulk(
        items,
        (item) => api.post(config.ignore.endpoint, config.ignore.body(item, instanceId)),
        { isBulk, signal, action: "ignore", setProgress },
      ),
    onSuccess: () => refetch(),
    onError: (e) => {
      if (isAbortError(e)) toast.info(tBulk("cancelled"));
    },
    onSettled: () => setProgress(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ items, search, isBulk, signal }: DeleteVars<T>) => {
      const deletable = items.filter(config.delete.isDeletable);
      const results = await runBulk(
        deletable,
        (item) => api.post<ActionLog>(config.delete.endpoint, config.delete.body(item, instanceId, search)),
        { isBulk, signal, action: "delete", setProgress },
      );
      return { results, search };
    },
    onSuccess: ({ results, search }) => {
      if (results.some((r) => r.isDryRun)) {
        toast.info(search ? tDelete("queuedAndSearchDryRun") : tDelete("queuedDryRun"));
      } else {
        toast.success(search ? deleteDoneAndSearch : deleteDone);
        void refetch();
      }
    },
    onError: (e) => {
      if (isAbortError(e)) toast.info(tBulk("cancelled"));
      else toast.error(deleteFailed);
    },
    onSettled: () => setProgress(null),
  });

  const ignoreWithToast = withToast(ignoreMutation, {
    success: tIgnore("done"),
    error: tIgnore("failed"),
  });

  return { searchMutation, ignoreMutation, ignoreWithToast, deleteMutation };
}
