import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";

interface ToastMessages {
  loading?: string;
  success: string;
  error?: string;
}

export function withToast<TData, TError, TVariables>(
  mutation: UseMutationResult<TData, TError, TVariables>,
  messages: ToastMessages
) {
  return (variables: TVariables) => {
    const promise = mutation.mutateAsync(variables);
    toast.promise(promise, {
      loading: messages.loading ?? "Loading…",
      success: messages.success,
      error: (err) =>
        messages.error ??
        (err instanceof Error ? err.message : "Something went wrong. See logs."),
    });
    return promise;
  };
}
