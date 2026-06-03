import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";

type ToastMessage<TData, TVariables> =
  | string
  | ((data: TData, variables: TVariables) => string);

type ToastErrorMessage<TError, TVariables> =
  | string
  | ((error: TError, variables: TVariables) => string);

interface ToastMessages {
  loading?: string;
}

interface ToastMessagesFor<TData, TError, TVariables> extends ToastMessages {
  success: ToastMessage<TData, TVariables>;
  error?: ToastErrorMessage<TError, TVariables>;
}

// Wraps a TanStack mutation so callers get success / loading / error toasts
// with a single call. All user-visible copy is the caller's responsibility —
// pass values from `useTranslations()` so the resulting toasts go through
// next-intl. The wrapper itself never injects English fallbacks.
//
// Loading toast is shown only when `loading` is provided, and morphs into
// the success or error toast via a shared id so the user sees a single
// transitioning toast rather than two flashes.
//
// Error fallback chain (when `messages.error` is omitted):
//   1. If the caught value is an Error, show `err.message`
//   2. Otherwise show no toast — the mutation still rejects, so callers
//      that need a generic toast can pass `error: t("toast.genericError")`
//      explicitly.
export function withToast<TData, TError, TVariables>(
  mutation: Pick<UseMutationResult<TData, TError, TVariables>, "mutateAsync">,
  messages: ToastMessagesFor<TData, TError, TVariables>,
) {
  return async (variables: TVariables): Promise<TData> => {
    const formatSuccess = (data: TData) =>
      typeof messages.success === "function"
        ? messages.success(data, variables)
        : messages.success;

    const formatError = (err: unknown): string | null => {
      // A full data volume (507 STORAGE_FULL) is an operational condition any
      // mutation can hit — always surface the server's readable message over
      // the caller's generic "failed" copy so the user knows to free space.
      if (
        err instanceof Error &&
        (err as { code?: string }).code === "STORAGE_FULL"
      ) {
        return err.message;
      }
      if (messages.error !== undefined) {
        return typeof messages.error === "function"
          ? messages.error(err as TError, variables)
          : messages.error;
      }
      return err instanceof Error ? err.message : null;
    };

    const id = messages.loading ? toast.loading(messages.loading) : undefined;
    const sharedOpts = id !== undefined ? { id } : undefined;

    try {
      const data = await mutation.mutateAsync(variables);
      toast.success(formatSuccess(data), sharedOpts);
      return data;
    } catch (err) {
      const errorMsg = formatError(err);
      if (errorMsg !== null) {
        toast.error(errorMsg, sharedOpts);
      } else if (id !== undefined) {
        toast.dismiss(id);
      }
      throw err;
    }
  };
}
