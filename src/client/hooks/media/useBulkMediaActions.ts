import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/client/lib/api";
import { withToast } from "@/client/lib/with-toast";
import { runMultiInstanceBulk } from "@/client/lib/multi-instance-bulk";
import { isAbortError } from "./useBulkAbort";
import type { ActionLog } from "@/shared/types/models";
import type { BulkProgress } from "@/client/components/media/BulkActionToolbar";

interface WithInstance {
  __instanceId: number;
}

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

// One delete-toast key set per media type. The series page uses the
// "filesDone" plurals while the movies page uses "fileDone" — pass the right
// key suffix via mediaType.
type MediaToastVariant = "movie" | "series";

export interface BulkActionsConfig<T extends WithInstance> {
  setProgress: (p: BulkProgress | null) => void;
  refetch: () => unknown;
  mediaType: MediaToastVariant;
  search: EndpointConfig<T>;
  ignore: EndpointConfig<T>;
  delete: DeleteEndpointConfig<T>;
}

// Three bulk mutations (search/ignore/delete) that follow the same pattern:
// fan out items by __instanceId, runSerial within each group, Promise.all
// across groups, emit aggregate progress, treat AbortError as a cancel toast.
// Page hooks (useMoviesPage, useShowsPage) call this factory once with their
// type-specific endpoint config — toast strings are resolved here.
export function useBulkMediaActions<T extends WithInstance>(config: BulkActionsConfig<T>) {
  const { setProgress, refetch, mediaType } = config;
  const tSearch = useTranslations("toast.search");
  const tDelete = useTranslations("toast.delete");
  const tIgnore = useTranslations("toast.ignore");
  const tBulk = useTranslations("bulk");

  const deleteDone = mediaType === "movie" ? tDelete("fileDone") : tDelete("filesDone");
  const deleteDoneAndSearch = mediaType === "movie" ? tDelete("fileDoneAndSearch") : tDelete("filesDoneAndSearch");
  const deleteFailed = mediaType === "movie" ? tDelete("fileFailed") : tDelete("filesFailed");

  const searchMutation = useMutation({
    mutationFn: ({ items, isBulk, signal }: BulkVars<T>) =>
      runMultiInstanceBulk(
        items,
        (item, instId) => api.post<ActionLog>(config.search.endpoint, config.search.body(item, instId)),
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
      runMultiInstanceBulk(
        items,
        (item, instId) => api.post(config.ignore.endpoint, config.ignore.body(item, instId)),
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
      const results = await runMultiInstanceBulk(
        deletable,
        (item, instId) => api.post<ActionLog>(config.delete.endpoint, config.delete.body(item, instId, search)),
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

  // Single-item ignore callers (row-hover, drawer) still get a sonner
  // toast.promise loading/success spinner; bulk progress UI covers multi-item.
  const ignoreWithToast = withToast(ignoreMutation, {
    success: tIgnore("done"),
    error: tIgnore("failed"),
  });

  return { searchMutation, ignoreMutation, ignoreWithToast, deleteMutation };
}
