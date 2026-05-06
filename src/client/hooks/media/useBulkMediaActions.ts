import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/client/lib/api";
import { withToast } from "@/client/lib/with-toast";
import { runSerial } from "@/client/lib/run-serial";
import type {
  BulkAction,
  BulkProgress,
} from "@/client/components/media/BulkActionToolbar";
import type { ActionLog, MediaType } from "@/shared/types/models";
import { isAbortError } from "./useBulkAbort";

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

export interface BulkActionsConfig<T> {
  instanceId: number;
  setProgress: (p: BulkProgress | null) => void;
  refetch: () => unknown;
  mediaType: MediaType;
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
      if (opts.isBulk)
        opts.setProgress({ current: i + 1, total, action: opts.action });
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

  const deleteDone =
    mediaType === "movie" ? tDelete("fileDone") : tDelete("filesDone");
  const deleteDoneAndSearch =
    mediaType === "movie"
      ? tDelete("fileDoneAndSearch")
      : tDelete("filesDoneAndSearch");
  const deleteFailed =
    mediaType === "movie" ? tDelete("fileFailed") : tDelete("filesFailed");

  const searchMutation = useMutation({
    mutationFn: ({ items, isBulk, signal }: BulkVars<T>) =>
      runBulk(
        items,
        (item) =>
          api.post<ActionLog>(
            config.search.endpoint,
            config.search.body(item, instanceId),
          ),
        { isBulk, signal, action: "search", setProgress },
      ),
    onSettled: () => setProgress(null),
  });

  const ignoreMutation = useMutation({
    mutationFn: ({ items, isBulk, signal }: BulkVars<T>) =>
      runBulk(
        items,
        (item) =>
          api.post(
            config.ignore.endpoint,
            config.ignore.body(item, instanceId),
          ),
        { isBulk, signal, action: "ignore", setProgress },
      ),
    onSuccess: () => refetch(),
    onSettled: () => setProgress(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ items, search, isBulk, signal }: DeleteVars<T>) => {
      const deletable = items.filter(config.delete.isDeletable);
      const results = await runBulk(
        deletable,
        (item) =>
          api.post<ActionLog>(
            config.delete.endpoint,
            config.delete.body(item, instanceId, search),
          ),
        { isBulk, signal, action: "delete", setProgress },
      );
      return { results, search };
    },
    onSuccess: ({ results }) => {
      if (!results.some((r) => r.isDryRun)) void refetch();
    },
    onSettled: () => setProgress(null),
  });

  const searchWithToast = withToast(searchMutation, {
    success: (results) =>
      results.some((r) => r.isDryRun)
        ? tSearch("queuedDryRun")
        : tSearch("started"),
    error: (e) => (isAbortError(e) ? tBulk("cancelled") : tSearch("failed")),
  });
  const ignoreWithToast = withToast(ignoreMutation, {
    success: tIgnore("done"),
    error: (e) => (isAbortError(e) ? tBulk("cancelled") : tIgnore("failed")),
  });
  const getDeleteSuccessMessage = ({
    results,
    search,
  }: {
    results: ActionLog[];
    search: boolean;
  }) => {
    if (results.some((r) => r.isDryRun)) {
      if (search) return tDelete("queuedAndSearchDryRun");
      return tDelete("queuedDryRun");
    }
    if (search) return deleteDoneAndSearch;
    return deleteDone;
  };
  const deleteWithToast = withToast(deleteMutation, {
    success: getDeleteSuccessMessage,
    error: (e) => (isAbortError(e) ? tBulk("cancelled") : deleteFailed),
  });

  return {
    searchMutation: { ...searchMutation, mutateAsync: searchWithToast },
    ignoreMutation: { ...ignoreMutation, mutateAsync: ignoreWithToast },
    ignoreWithToast,
    deleteMutation: { ...deleteMutation, mutateAsync: deleteWithToast },
  };
}
